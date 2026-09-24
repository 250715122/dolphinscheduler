package org.apache.dolphinscheduler.plugin.task.api.parameters;

import org.apache.dolphinscheduler.plugin.task.api.SQLTaskExecutionContext;
import org.apache.dolphinscheduler.plugin.task.api.enums.ResourceType;
import org.apache.dolphinscheduler.plugin.task.api.parameters.resource.DataSourceParameters;
import org.apache.dolphinscheduler.plugin.task.api.parameters.resource.ResourceParametersHelper;

import org.apache.commons.lang3.StringUtils;

import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * Lightweight SQL assert for data quality.
 * Runs one SELECT returning a single numeric cell, then compares with operator + threshold.
 */
@Data
@EqualsAndHashCode(callSuper = true)
public class SqlCheckParameters extends AbstractParameters {

    /** DbType name: STARROCKS / MYSQL / POSTGRESQL */
    private String type;

    private int datasource;

    private String sql;

    /** EQ, NE, GT, GE, LT, LE */
    private String operator = "GT";

    private Double threshold = 0d;

    private String checkName;

    @Override
    public boolean checkParameters() {
        return datasource > 0
                && StringUtils.isNotBlank(type)
                && StringUtils.isNotBlank(sql)
                && StringUtils.isNotBlank(operator)
                && threshold != null;
    }

    @Override
    public ResourceParametersHelper getResources() {
        ResourceParametersHelper resources = super.getResources();
        resources.put(ResourceType.DATASOURCE, datasource);
        return resources;
    }

    public SQLTaskExecutionContext generateExtendedContext(ResourceParametersHelper parametersHelper) {
        SQLTaskExecutionContext ctx = new SQLTaskExecutionContext();
        DataSourceParameters dbSource =
                (DataSourceParameters) parametersHelper.getResourceParameters(ResourceType.DATASOURCE, datasource);
        if (dbSource != null) {
            ctx.setConnectionParams(dbSource.getConnectionParams());
        }
        return ctx;
    }
}
