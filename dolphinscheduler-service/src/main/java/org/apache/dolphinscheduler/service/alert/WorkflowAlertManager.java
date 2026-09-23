/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package org.apache.dolphinscheduler.service.alert;

import org.apache.dolphinscheduler.common.enums.AlertType;
import org.apache.dolphinscheduler.common.enums.CommandType;
import org.apache.dolphinscheduler.common.enums.Flag;
import org.apache.dolphinscheduler.common.enums.WarningType;
import org.apache.dolphinscheduler.common.utils.JSONUtils;
import org.apache.dolphinscheduler.dao.AlertDao;
import org.apache.dolphinscheduler.dao.entity.Alert;
import org.apache.dolphinscheduler.dao.entity.Project;
import org.apache.dolphinscheduler.dao.entity.ProjectUser;
import org.apache.dolphinscheduler.dao.entity.TaskInstance;
import org.apache.dolphinscheduler.dao.entity.User;
import org.apache.dolphinscheduler.dao.entity.WorkflowAlertContent;
import org.apache.dolphinscheduler.dao.entity.WorkflowDefinitionLog;
import org.apache.dolphinscheduler.dao.entity.WorkflowInstance;
import org.apache.dolphinscheduler.dao.repository.ProjectDao;
import org.apache.dolphinscheduler.dao.repository.TaskInstanceDao;
import org.apache.dolphinscheduler.dao.repository.UserDao;
import org.apache.dolphinscheduler.dao.repository.WorkflowDefinitionLogDao;
import org.apache.dolphinscheduler.plugin.task.api.enums.TaskExecutionStatus;

import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.time.DateFormatUtils;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

import lombok.extern.slf4j.Slf4j;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class WorkflowAlertManager {

    private static final String TIME_PATTERN = "yyyy-MM-dd HH:mm:ss";

    @Autowired
    private AlertDao alertDao;

    @Autowired
    private WorkflowDefinitionLogDao workflowDefinitionLogDao;

    @Autowired
    private UserDao userDao;

    @Autowired
    private ProjectDao projectDao;

    @Autowired
    private TaskInstanceDao taskInstanceDao;

    /**
     * convert command type to human-readable name
     *
     * @param commandType command type
     * @return command name
     */
    private String getCommandCnName(CommandType commandType) {
        switch (commandType) {
            case RECOVER_TOLERANCE_FAULT_PROCESS:
                return "容错恢复";
            case RECOVER_SUSPENDED_PROCESS:
                return "恢复暂停工作流";
            case START_CURRENT_TASK_PROCESS:
                return "从当前节点开始";
            case START_FAILURE_TASK_PROCESS:
                return "从失败节点开始";
            case START_PROCESS:
                return "手动启动";
            case REPEAT_RUNNING:
                return "重跑";
            case SCHEDULER:
                return "调度";
            case COMPLEMENT_DATA:
                return "补数";
            case PAUSE:
                return "暂停";
            case STOP:
                return "停止";
            default:
                return commandType == null ? "未知" : commandType.name();
        }
    }

    private String formatTime(Date date) {
        return date == null ? "-" : DateFormatUtils.format(date, TIME_PATTERN);
    }

    private String resolveModifyBy(WorkflowInstance workflowInstance) {
        WorkflowDefinitionLog workflowDefinitionLog = workflowDefinitionLogDao
                .queryByDefinitionCodeAndVersion(workflowInstance.getWorkflowDefinitionCode(),
                        workflowInstance.getWorkflowDefinitionVersion());
        if (workflowDefinitionLog == null) {
            return "";
        }
        User operator = userDao.queryById(workflowDefinitionLog.getOperator());
        return operator == null ? "" : operator.getUserName();
    }

    private String resolveFailedTaskNames(WorkflowInstance workflowInstance) {
        try {
            List<TaskInstance> taskInstances = taskInstanceDao.queryByWorkflowInstanceId(workflowInstance.getId());
            if (taskInstances == null || taskInstances.isEmpty()) {
                return "";
            }
            return taskInstances.stream()
                    .filter(Objects::nonNull)
                    .filter(t -> t.getState() == TaskExecutionStatus.FAILURE)
                    .map(TaskInstance::getName)
                    .filter(StringUtils::isNotBlank)
                    .distinct()
                    .collect(Collectors.joining(", "));
        } catch (Exception e) {
            log.warn("query failed tasks for workflowInstanceId={} failed: {}", workflowInstance.getId(),
                    e.getMessage());
            return "";
        }
    }

    private String buildReadableTitle(WorkflowInstance workflowInstance, Project project, boolean success) {
        String result = success ? "成功" : "失败";
        String cmd = getCommandCnName(workflowInstance.getCommandType());
        String projectName = project == null || StringUtils.isBlank(project.getName()) ? "-" : project.getName();
        String instanceName =
                StringUtils.isBlank(workflowInstance.getName()) ? String.valueOf(workflowInstance.getId())
                        : workflowInstance.getName();
        return String.format("【%s%s】%s / %s", cmd, result, projectName, instanceName);
    }

    private String buildReadableContent(WorkflowInstance workflowInstance, Project project, boolean success) {
        String result = success ? "成功" : "失败";
        String cmd = getCommandCnName(workflowInstance.getCommandType());
        String projectName = project == null || StringUtils.isBlank(project.getName()) ? "-" : project.getName();
        String modifyBy = resolveModifyBy(workflowInstance);
        String failedTasks = success ? "" : resolveFailedTaskNames(workflowInstance);

        StringBuilder sb = new StringBuilder();
        sb.append("【告警类型】").append(cmd).append(result).append('\n');
        sb.append("【项目】").append(projectName).append('\n');
        sb.append("【工作流实例】").append(nullToDash(workflowInstance.getName())).append('\n');
        sb.append("【实例ID】").append(workflowInstance.getId()).append('\n');
        sb.append("【状态】").append(workflowInstance.getState() == null ? "-" : workflowInstance.getState().name())
                .append('\n');
        if (StringUtils.isNotBlank(failedTasks)) {
            sb.append("【失败任务】").append(failedTasks).append('\n');
        }
        sb.append("【开始时间】").append(formatTime(workflowInstance.getStartTime())).append('\n');
        sb.append("【结束时间】").append(formatTime(workflowInstance.getEndTime())).append('\n');
        sb.append("【运行主机】").append(nullToDash(workflowInstance.getHost())).append('\n');
        sb.append("【触发方式】").append(workflowInstance.getCommandType() == null ? "-"
                : workflowInstance.getCommandType().name()).append('\n');
        sb.append("【运行次数】").append(workflowInstance.getRunTimes()).append('\n');
        if (StringUtils.isNotBlank(modifyBy)) {
            sb.append("【定义修改人】").append(modifyBy).append('\n');
        }
        return sb.toString().trim();
    }

    private static String nullToDash(String value) {
        return StringUtils.isBlank(value) ? "-" : value;
    }

    /**
     * get workflow instance content
     *
     * @param workflowInstance workflow instance
     * @return workflow instance format content
     */
    public String getContentWorkflowInstance(WorkflowInstance workflowInstance,
                                             Project project) {
        boolean success = workflowInstance.getState() != null && workflowInstance.getState().isSuccess();
        // Human-readable content for DingTalk/Feishu/WeChat text channels.
        // Keep a structured JSON fallback field for plugins that still parse JSON.
        String readable = buildReadableContent(workflowInstance, project, success);
        String modifyBy = resolveModifyBy(workflowInstance);
        String failedTasks = success ? "" : resolveFailedTaskNames(workflowInstance);

        List<WorkflowAlertContent> contentList = new ArrayList<>(1);
        WorkflowAlertContent.WorkflowAlertContentBuilder builder = WorkflowAlertContent.builder()
                .projectCode(project == null ? null : project.getCode())
                .projectName(project == null ? null : project.getName())
                .owner(project == null ? null : project.getUserName())
                .workflowInstanceId(workflowInstance.getId())
                .workflowDefinitionCode(workflowInstance.getWorkflowDefinitionCode())
                .workflowInstanceName(workflowInstance.getName())
                .commandType(workflowInstance.getCommandType())
                .workflowExecutionStatus(workflowInstance.getState())
                .modifyBy(modifyBy)
                .recovery(workflowInstance.getRecovery())
                .runTimes(workflowInstance.getRunTimes())
                .workflowStartTime(workflowInstance.getStartTime())
                .workflowEndTime(workflowInstance.getEndTime())
                .workflowHost(workflowInstance.getHost());
        if (StringUtils.isNotBlank(failedTasks)) {
            // reuse taskName field to carry failed task summary for JSON consumers
            builder.taskName(failedTasks);
        }
        contentList.add(builder.build());

        // Prefer readable text; append JSON block for tooling that still expects structure.
        return readable;
    }

    /**
     * getting worker fault tolerant content
     *
     * @param workflowInstance workflow instance
     * @param toleranceTaskList tolerance task list
     * @return worker tolerance content
     */
    private String getWorkerToleranceContent(WorkflowInstance workflowInstance, List<TaskInstance> toleranceTaskList) {

        String modifyBy = resolveModifyBy(workflowInstance);
        String taskNames = toleranceTaskList == null ? ""
                : toleranceTaskList.stream().map(TaskInstance::getName).filter(StringUtils::isNotBlank)
                        .collect(Collectors.joining(", "));

        StringBuilder sb = new StringBuilder();
        sb.append("【告警类型】Worker容错\n");
        sb.append("【工作流实例】").append(nullToDash(workflowInstance.getName())).append('\n');
        sb.append("【实例ID】").append(workflowInstance.getId()).append('\n');
        sb.append("【容错任务】").append(StringUtils.isBlank(taskNames) ? "-" : taskNames).append('\n');
        if (StringUtils.isNotBlank(modifyBy)) {
            sb.append("【定义修改人】").append(modifyBy).append('\n');
        }

        List<WorkflowAlertContent> toleranceTaskInstanceList = new ArrayList<>();
        if (toleranceTaskList != null) {
            for (TaskInstance taskInstance : toleranceTaskList) {
                WorkflowAlertContent workflowAlertContent = WorkflowAlertContent.builder()
                        .workflowInstanceId(workflowInstance.getId())
                        .workflowDefinitionCode(workflowInstance.getWorkflowDefinitionCode())
                        .workflowInstanceName(workflowInstance.getName())
                        .modifyBy(modifyBy)
                        .taskCode(taskInstance.getTaskCode())
                        .taskName(taskInstance.getName())
                        .taskHost(taskInstance.getHost())
                        .taskPriority(taskInstance.getTaskInstancePriority().getDescp())
                        .retryTimes(taskInstance.getRetryTimes())
                        .build();
                toleranceTaskInstanceList.add(workflowAlertContent);
            }
        }
        return sb.toString().trim();
    }

    /**
     * send worker alert fault tolerance
     *
     * @param workflowInstance workflow instance
     * @param toleranceTaskList tolerance task list
     */
    public void sendAlertWorkerToleranceFault(WorkflowInstance workflowInstance, List<TaskInstance> toleranceTaskList) {
        try {
            Alert alert = new Alert();
            String taskNames = toleranceTaskList == null ? ""
                    : toleranceTaskList.stream().map(TaskInstance::getName).filter(StringUtils::isNotBlank)
                            .collect(Collectors.joining(", "));
            alert.setTitle(String.format("【Worker容错】%s / %s", nullToDash(workflowInstance.getName()),
                    StringUtils.isBlank(taskNames) ? "-" : taskNames));
            String content = getWorkerToleranceContent(workflowInstance, toleranceTaskList);
            alert.setContent(content);
            alert.setWarningType(WarningType.FAILURE);
            alert.setCreateTime(new Date());
            alert.setAlertGroupId(
                    workflowInstance.getWarningGroupId() == null ? 1 : workflowInstance.getWarningGroupId());
            alert.setAlertType(AlertType.FAULT_TOLERANCE_WARNING);
            alertDao.addAlert(alert);

        } catch (Exception e) {
            log.error("send alert failed:{} ", e.getMessage());
        }

    }

    /**
     * send workflow instance alert
     *
     * @param workflowInstance workflow instance
     */
    public void sendAlertWorkflowInstance(WorkflowInstance workflowInstance) {
        if (!isNeedToSendWarning(workflowInstance)) {
            return;
        }
        Project project = projectDao.queryByCode(workflowInstance.getProjectCode());
        boolean success = workflowInstance.getState() != null && workflowInstance.getState().isSuccess();

        Alert alert = new Alert();
        alert.setTitle(buildReadableTitle(workflowInstance, project, success));
        alert.setWarningType(success ? WarningType.SUCCESS : WarningType.FAILURE);
        alert.setContent(getContentWorkflowInstance(workflowInstance, project));
        alert.setAlertGroupId(workflowInstance.getWarningGroupId());
        alert.setCreateTime(new Date());
        alert.setProjectCode(workflowInstance.getProjectCode());
        alert.setWorkflowDefinitionCode(workflowInstance.getWorkflowDefinitionCode());
        alert.setWorkflowInstanceId(workflowInstance.getId());
        alert.setAlertType(success ? AlertType.WORKFLOW_INSTANCE_SUCCESS : AlertType.WORKFLOW_INSTANCE_FAILURE);
        alertDao.addAlert(alert);
    }

    /**
     * check if need to be sent warning
     *
     * @param workflowInstance
     * @return
     */
    public boolean isNeedToSendWarning(WorkflowInstance workflowInstance) {
        if (Flag.YES == workflowInstance.getIsSubWorkflow()) {
            return false;
        }
        boolean sendWarning = false;
        WarningType warningType = workflowInstance.getWarningType();
        switch (warningType) {
            case ALL:
                if (workflowInstance.getState().isFinalState()) {
                    sendWarning = true;
                }
                break;
            case SUCCESS:
                if (workflowInstance.getState().isSuccess()) {
                    sendWarning = true;
                }
                break;
            case FAILURE:
                if (workflowInstance.getState().isFailure()) {
                    sendWarning = true;
                }
                break;
            default:
        }
        return sendWarning;
    }

    public void sendTaskTimeoutAlert(WorkflowInstance workflowInstance,
                                     TaskInstance taskInstance) {
        ProjectUser projectUser = projectDao.queryProjectWithUserByWorkflowInstanceId(workflowInstance.getId());
        alertDao.sendTaskTimeoutAlert(workflowInstance, taskInstance, projectUser);
    }
}
