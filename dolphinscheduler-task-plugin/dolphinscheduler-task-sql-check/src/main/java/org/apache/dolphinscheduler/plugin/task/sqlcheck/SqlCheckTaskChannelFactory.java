package org.apache.dolphinscheduler.plugin.task.sqlcheck;

import org.apache.dolphinscheduler.plugin.task.api.TaskChannel;
import org.apache.dolphinscheduler.plugin.task.api.TaskChannelFactory;

import com.google.auto.service.AutoService;

@AutoService(TaskChannelFactory.class)
public class SqlCheckTaskChannelFactory implements TaskChannelFactory {

    public static final String NAME = "SQL_CHECK";

    @Override
    public String getName() {
        return NAME;
    }

    @Override
    public TaskChannel create() {
        return new SqlCheckTaskChannel();
    }
}
