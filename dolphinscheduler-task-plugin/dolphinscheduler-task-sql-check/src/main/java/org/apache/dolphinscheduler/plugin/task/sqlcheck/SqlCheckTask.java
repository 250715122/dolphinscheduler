package org.apache.dolphinscheduler.plugin.task.sqlcheck;

import org.apache.dolphinscheduler.common.utils.DateUtils;
import org.apache.dolphinscheduler.common.utils.JSONUtils;
import org.apache.dolphinscheduler.plugin.datasource.api.plugin.DataSourceClientProvider;
import org.apache.dolphinscheduler.plugin.datasource.api.utils.DataSourceUtils;
import org.apache.dolphinscheduler.plugin.task.api.AbstractTask;
import org.apache.dolphinscheduler.plugin.task.api.SQLTaskExecutionContext;
import org.apache.dolphinscheduler.plugin.task.api.TaskCallBack;
import org.apache.dolphinscheduler.plugin.task.api.TaskConstants;
import org.apache.dolphinscheduler.plugin.task.api.TaskException;
import org.apache.dolphinscheduler.plugin.task.api.TaskExecutionContext;
import org.apache.dolphinscheduler.plugin.task.api.model.Property;
import org.apache.dolphinscheduler.plugin.task.api.parameters.AbstractParameters;
import org.apache.dolphinscheduler.plugin.task.api.model.ApplicationInfo;
import org.apache.dolphinscheduler.plugin.task.api.parameters.SqlCheckParameters;
import org.apache.dolphinscheduler.plugin.task.api.utils.ParameterUtils;
import org.apache.dolphinscheduler.spi.datasource.BaseConnectionParam;
import org.apache.dolphinscheduler.spi.enums.DbType;

import org.apache.commons.lang3.StringUtils;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.HashMap;
import java.util.Map;

import lombok.extern.slf4j.Slf4j;

/**
 * Execute custom comparison SQL and fail when (actual operator threshold) is true.
 * Example: actual=diff_count, operator=GT, threshold=0 → fail when there are diffs.
 */
@Slf4j
public class SqlCheckTask extends AbstractTask {

    private final TaskExecutionContext taskExecutionContext;
    private final SqlCheckParameters parameters;
    private final SQLTaskExecutionContext sqlTaskExecutionContext;
    private final DbType dbType;

    public SqlCheckTask(TaskExecutionContext taskRequest) {
        super(taskRequest);
        this.taskExecutionContext = taskRequest;
        this.parameters = JSONUtils.parseObject(taskExecutionContext.getTaskParams(), SqlCheckParameters.class);
        log.info("Initialize SQL_CHECK parameter {}", JSONUtils.toPrettyJsonString(parameters));
        if (parameters == null || !parameters.checkParameters()) {
            throw new TaskException("SQL_CHECK task params is not valid");
        }
        this.sqlTaskExecutionContext =
                parameters.generateExtendedContext(taskExecutionContext.getResourceParametersHelper());
        this.dbType = DbType.valueOf(parameters.getType());
    }

    @Override
    public AbstractParameters getParameters() {
        return parameters;
    }

    @Override
    public void handle(TaskCallBack taskCallBack) throws TaskException {
        String sql = parameters.getSql();
        sql = ParameterUtils.replaceScheduleTime(sql,
                DateUtils.timeStampToDate(taskExecutionContext.getScheduleTime()));
        Map<String, Property> paramsMap = taskExecutionContext.getPrepareParamsMap();
        if (paramsMap != null && !paramsMap.isEmpty()) {
            sql = ParameterUtils.convertParameterPlaceholders(sql, ParameterUtils.convert(paramsMap));
        }

        log.info("SQL_CHECK name={}, type={}, datasource={}, operator={}, threshold={}, sql={}",
                parameters.getCheckName(), parameters.getType(), parameters.getDatasource(),
                parameters.getOperator(), parameters.getThreshold(), sql);

        BaseConnectionParam connectionParam = (BaseConnectionParam) DataSourceUtils.buildConnectionParams(
                dbType, sqlTaskExecutionContext.getConnectionParams());

        try (Connection connection = DataSourceClientProvider.getAdHocConnection(dbType, connectionParam);
                Statement statement = connection.createStatement();
                ResultSet rs = statement.executeQuery(sql)) {
            if (!rs.next()) {
                throw new TaskException("SQL_CHECK returned no rows; expect one numeric cell");
            }
            Object cell = rs.getObject(1);
            if (cell == null) {
                throw new TaskException("SQL_CHECK first cell is null");
            }
            double actual = cell instanceof Number
                    ? ((Number) cell).doubleValue()
                    : new BigDecimal(cell.toString().trim()).doubleValue();

            boolean failCondition = evaluate(actual, parameters.getOperator(), parameters.getThreshold());
            boolean passed = !failCondition;
            String message = String.format("actual=%s %s threshold=%s => %s",
                    actual, parameters.getOperator(), parameters.getThreshold(),
                    failCondition ? "FAIL" : "PASS");
            log.info("SQL_CHECK result: {}", message);

            Map<String, Object> result = new HashMap<>();
            result.put("checkName", StringUtils.defaultIfBlank(parameters.getCheckName(), "sql_check"));
            result.put("actual", actual);
            result.put("operator", parameters.getOperator());
            result.put("threshold", parameters.getThreshold());
            result.put("passed", passed);
            result.put("datasourceType", parameters.getType());
            result.put("datasourceId", parameters.getDatasource());
            String json = JSONUtils.toJsonString(result);
            taskExecutionContext.setAppIds(json);
            if (taskCallBack != null) {
                taskCallBack.updateRemoteApplicationInfo(
                        taskExecutionContext.getTaskInstanceId(), new ApplicationInfo(json));
            }

            if (failCondition) {
                setExitStatusCode(TaskConstants.EXIT_CODE_FAILURE);
                throw new TaskException("SQL_CHECK failed: " + message);
            }
            setExitStatusCode(TaskConstants.EXIT_CODE_SUCCESS);
        } catch (TaskException te) {
            setExitStatusCode(TaskConstants.EXIT_CODE_FAILURE);
            throw te;
        } catch (Exception e) {
            setExitStatusCode(TaskConstants.EXIT_CODE_FAILURE);
            log.error("SQL_CHECK execute error", e);
            throw new TaskException("SQL_CHECK execute error: " + e.getMessage(), e);
        }
    }

    /** true when (actual op threshold) holds — used as failure condition */
    static boolean evaluate(double actual, String operator, double threshold) {
        String op = operator == null ? "GT" : operator.trim().toUpperCase();
        switch (op) {
            case "EQ":
            case "=":
            case "==":
                return Double.compare(actual, threshold) == 0;
            case "NE":
            case "!=":
            case "<>":
                return Double.compare(actual, threshold) != 0;
            case "GT":
            case ">":
                return actual > threshold;
            case "GE":
            case ">=":
                return actual >= threshold;
            case "LT":
            case "<":
                return actual < threshold;
            case "LE":
            case "<=":
                return actual <= threshold;
            default:
                throw new TaskException("Unsupported SQL_CHECK operator: " + operator);
        }
    }

    @Override
    public void cancel() {
        // no long-running process
    }
}
