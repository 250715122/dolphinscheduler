package org.apache.dolphinscheduler.plugin.task.sqlcheck;

import org.apache.dolphinscheduler.common.utils.JSONUtils;
import org.apache.dolphinscheduler.plugin.task.api.AbstractTask;
import org.apache.dolphinscheduler.plugin.task.api.TaskChannel;
import org.apache.dolphinscheduler.plugin.task.api.TaskExecutionContext;
import org.apache.dolphinscheduler.plugin.task.api.parameters.AbstractParameters;
import org.apache.dolphinscheduler.plugin.task.api.parameters.SqlCheckParameters;

public class SqlCheckTaskChannel implements TaskChannel {

    @Override
    public AbstractTask createTask(TaskExecutionContext taskRequest) {
        return new SqlCheckTask(taskRequest);
    }

    @Override
    public AbstractParameters parseParameters(String taskParams) {
        return JSONUtils.parseObject(taskParams, SqlCheckParameters.class);
    }
}
