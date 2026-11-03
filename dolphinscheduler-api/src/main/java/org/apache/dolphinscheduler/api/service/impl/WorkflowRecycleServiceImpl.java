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

package org.apache.dolphinscheduler.api.service.impl;

import org.apache.dolphinscheduler.api.dto.DagDataSchedule;
import org.apache.dolphinscheduler.api.enums.Status;
import org.apache.dolphinscheduler.api.exceptions.ServiceException;
import org.apache.dolphinscheduler.api.service.ProjectService;
import org.apache.dolphinscheduler.api.service.WorkflowDefinitionService;
import org.apache.dolphinscheduler.api.service.WorkflowRecycleService;
import org.apache.dolphinscheduler.api.utils.PageInfo;
import org.apache.dolphinscheduler.common.enums.UserType;
import org.apache.dolphinscheduler.common.utils.JSONUtils;
import org.apache.dolphinscheduler.dao.entity.Project;
import org.apache.dolphinscheduler.dao.entity.SystemSetting;
import org.apache.dolphinscheduler.dao.entity.User;
import org.apache.dolphinscheduler.dao.entity.WorkflowRecycle;
import org.apache.dolphinscheduler.dao.mapper.ProjectMapper;
import org.apache.dolphinscheduler.dao.mapper.SystemSettingMapper;
import org.apache.dolphinscheduler.dao.mapper.WorkflowRecycleMapper;

import org.apache.commons.lang3.StringUtils;

import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;

import lombok.extern.slf4j.Slf4j;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;

@Service
@Slf4j
public class WorkflowRecycleServiceImpl extends BaseServiceImpl implements WorkflowRecycleService {

    public static final String KEY_RETENTION_DAYS = "workflow.recycle.retention.days";
    public static final int DEFAULT_RETENTION_DAYS = 60;
    private static final int MAX_RETENTION_DAYS = 3650;
    private static final String PERM_VIEW = "project:definition:view";
    private static final String PERM_DELETE = "project:definition:version:delete";
    private static final String PERM_IMPORT = "project:definition:import";

    @Autowired
    private WorkflowRecycleMapper recycleMapper;

    @Autowired
    private SystemSettingMapper settingMapper;

    @Autowired
    private ProjectMapper projectMapper;

    @Autowired
    private ProjectService projectService;

    @Autowired
    private WorkflowDefinitionService workflowDefinitionService;

    private volatile Thread purgeThread;

    @PostConstruct
    public void startPurgeThread() {
        Thread t = new Thread(() -> {
            // first run shortly after startup, then hourly
            long sleepMs = 2 * 60 * 1000L;
            while (!Thread.currentThread().isInterrupted()) {
                try {
                    Thread.sleep(sleepMs);
                    sleepMs = 60 * 60 * 1000L;
                    int n = purgeExpired();
                    if (n > 0) {
                        log.info("Workflow recycle bin purged {} expired item(s)", n);
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } catch (Exception e) {
                    log.error("Workflow recycle bin purge failed, will retry next round", e);
                }
            }
        }, "workflow-recycle-purge");
        t.setDaemon(true);
        t.start();
        purgeThread = t;
    }

    @PreDestroy
    public void stopPurgeThread() {
        Thread t = purgeThread;
        if (t != null) {
            t.interrupt();
        }
    }

    @Override
    public int getRetentionDays() {
        SystemSetting s = settingMapper.selectById(KEY_RETENTION_DAYS);
        if (s == null || StringUtils.isBlank(s.getSettingValue())) {
            return DEFAULT_RETENTION_DAYS;
        }
        try {
            int d = Integer.parseInt(s.getSettingValue().trim());
            return d >= 1 ? d : DEFAULT_RETENTION_DAYS;
        } catch (NumberFormatException e) {
            return DEFAULT_RETENTION_DAYS;
        }
    }

    @Override
    public void updateRetentionDays(User loginUser, int days) {
        if (loginUser.getUserType() != UserType.ADMIN_USER) {
            throw new ServiceException(Status.USER_NO_OPERATION_PERM);
        }
        if (days < 1 || days > MAX_RETENTION_DAYS) {
            throw new ServiceException(Status.REQUEST_PARAMS_NOT_VALID_ERROR, "days must be 1-" + MAX_RETENTION_DAYS);
        }
        SystemSetting s = settingMapper.selectById(KEY_RETENTION_DAYS);
        if (s == null) {
            s = new SystemSetting();
            s.setSettingKey(KEY_RETENTION_DAYS);
            s.setSettingValue(String.valueOf(days));
            s.setUpdateTime(new Date());
            settingMapper.insert(s);
        } else {
            s.setSettingValue(String.valueOf(days));
            s.setUpdateTime(new Date());
            settingMapper.updateById(s);
        }
    }

    @Override
    public Map<String, Object> queryRecycleBin(User loginUser, long projectCode, String searchVal, int pageNo,
                                               int pageSize) {
        projectService.checkProjectAndAuthThrowException(loginUser, projectCode, PERM_VIEW);
        QueryWrapper<WorkflowRecycle> qw = new QueryWrapper<>();
        qw.select("id", "workflow_code", "workflow_name", "project_code", "description", "task_count",
                "owner_user_id", "delete_user_id", "delete_time");
        qw.eq("project_code", projectCode);
        if (StringUtils.isNotBlank(searchVal)) {
            qw.like("workflow_name", searchVal);
        }
        qw.orderByDesc("delete_time");
        IPage<WorkflowRecycle> page = recycleMapper.selectPage(new Page<>(pageNo, pageSize), qw);
        int retention = getRetentionDays();
        List<Map<String, Object>> rows = page.getRecords().stream().map(r -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", r.getId());
            m.put("workflowCode", String.valueOf(r.getWorkflowCode()));
            m.put("workflowName", r.getWorkflowName());
            m.put("projectCode", String.valueOf(r.getProjectCode()));
            m.put("description", r.getDescription());
            m.put("taskCount", r.getTaskCount());
            m.put("deleteTime", r.getDeleteTime());
            Calendar c = Calendar.getInstance();
            c.setTime(r.getDeleteTime());
            c.add(Calendar.DAY_OF_YEAR, retention);
            m.put("expireTime", c.getTime());
            m.put("remainingDays", Math.max(0L,
                    (long) Math.ceil((c.getTimeInMillis() - System.currentTimeMillis()) / 86400000.0)));
            return m;
        }).collect(Collectors.toList());
        Map<String, Object> result = new HashMap<>();
        result.put("retentionDays", retention);
        PageInfo<Map<String, Object>> pageInfo = new PageInfo<>(pageNo, pageSize);
        pageInfo.setTotal((int) page.getTotal());
        pageInfo.setTotalList(rows);
        result.put("page", pageInfo);
        return result;
    }

    private WorkflowRecycle mustGet(int id, long projectCode) {
        WorkflowRecycle r = recycleMapper.selectById(id);
        if (r == null || r.getProjectCode() != projectCode) {
            throw new ServiceException(Status.INTERNAL_SERVER_ERROR_ARGS, "recycle item not found: " + id);
        }
        return r;
    }

    @Override
    public void restore(User loginUser, long projectCode, int id) {
        projectService.checkProjectAndAuthThrowException(loginUser, projectCode, PERM_IMPORT);
        WorkflowRecycle r = mustGet(id, projectCode);
        DagDataSchedule dag = JSONUtils.parseObject(r.getDagJson(), DagDataSchedule.class);
        if (dag == null) {
            throw new ServiceException(Status.INTERNAL_SERVER_ERROR_ARGS, "snapshot is broken");
        }
        Map<String, Object> result = new HashMap<>();
        workflowDefinitionService.restoreFromSnapshot(loginUser, projectCode, result, dag);
        Object st = result.get("status");
        if (st != Status.SUCCESS) {
            Object msg = result.get("msg");
            throw new ServiceException(Status.INTERNAL_SERVER_ERROR_ARGS,
                    "restore failed: " + (msg == null ? String.valueOf(st) : msg));
        }
        recycleMapper.deleteById(id);
        log.info("Workflow {} restored from recycle bin by {}", r.getWorkflowCode(), loginUser.getUserName());
    }

    @Override
    public void purge(User loginUser, long projectCode, int id) {
        Project project = projectMapper.queryByCode(projectCode);
        projectService.checkProjectAndAuthThrowException(loginUser, project, PERM_DELETE);
        WorkflowRecycle r = mustGet(id, projectCode);
        recycleMapper.deleteById(r.getId());
    }

    @Override
    public int purgeExpired() {
        Calendar c = Calendar.getInstance();
        c.add(Calendar.DAY_OF_YEAR, -getRetentionDays());
        return recycleMapper.delete(new QueryWrapper<WorkflowRecycle>().lt("delete_time", c.getTime()));
    }
}
