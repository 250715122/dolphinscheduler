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

package org.apache.dolphinscheduler.api.controller;

import org.apache.dolphinscheduler.api.exceptions.ApiException;
import org.apache.dolphinscheduler.api.service.WorkflowRecycleService;
import org.apache.dolphinscheduler.api.utils.Result;
import org.apache.dolphinscheduler.common.constants.Constants;
import org.apache.dolphinscheduler.dao.entity.User;

import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * Workflow recycle bin: deleted workflows are kept (as a definition snapshot) until the retention expires.
 */
@Tag(name = "WORKFLOW_RECYCLE_TAG")
@RestController
@RequestMapping
public class WorkflowRecycleController extends BaseController {

    @Autowired
    private WorkflowRecycleService recycleService;

    @GetMapping("/projects/{projectCode}/workflow-recycle")
    @ResponseStatus(HttpStatus.OK)
    @ApiException(org.apache.dolphinscheduler.api.enums.Status.INTERNAL_SERVER_ERROR_ARGS)
    public Result<Map<String, Object>> list(@Parameter(hidden = true) @RequestAttribute(value = Constants.SESSION_USER) User loginUser,
                                            @PathVariable long projectCode,
                                            @RequestParam(value = "searchVal", required = false) String searchVal,
                                            @RequestParam("pageNo") Integer pageNo,
                                            @RequestParam("pageSize") Integer pageSize) {
        checkPageParams(pageNo, pageSize);
        return Result.success(recycleService.queryRecycleBin(loginUser, projectCode, searchVal, pageNo, pageSize));
    }

    @PostMapping("/projects/{projectCode}/workflow-recycle/{id}/restore")
    @ResponseStatus(HttpStatus.OK)
    @ApiException(org.apache.dolphinscheduler.api.enums.Status.INTERNAL_SERVER_ERROR_ARGS)
    public Result restore(@Parameter(hidden = true) @RequestAttribute(value = Constants.SESSION_USER) User loginUser,
                          @PathVariable long projectCode,
                          @PathVariable int id) {
        recycleService.restore(loginUser, projectCode, id);
        return Result.success(null);
    }

    @DeleteMapping("/projects/{projectCode}/workflow-recycle/{id}")
    @ResponseStatus(HttpStatus.OK)
    @ApiException(org.apache.dolphinscheduler.api.enums.Status.INTERNAL_SERVER_ERROR_ARGS)
    public Result purge(@Parameter(hidden = true) @RequestAttribute(value = Constants.SESSION_USER) User loginUser,
                        @PathVariable long projectCode,
                        @PathVariable int id) {
        recycleService.purge(loginUser, projectCode, id);
        return Result.success(null);
    }

    @GetMapping("/system-settings/workflow-recycle")
    @ResponseStatus(HttpStatus.OK)
    @ApiException(org.apache.dolphinscheduler.api.enums.Status.INTERNAL_SERVER_ERROR_ARGS)
    public Result<Map<String, Object>> getRetention(@Parameter(hidden = true) @RequestAttribute(value = Constants.SESSION_USER) User loginUser) {
        Map<String, Object> m = new HashMap<>();
        m.put("retentionDays", recycleService.getRetentionDays());
        return Result.success(m);
    }

    @PutMapping("/system-settings/workflow-recycle")
    @ResponseStatus(HttpStatus.OK)
    @ApiException(org.apache.dolphinscheduler.api.enums.Status.INTERNAL_SERVER_ERROR_ARGS)
    public Result updateRetention(@Parameter(hidden = true) @RequestAttribute(value = Constants.SESSION_USER) User loginUser,
                                  @RequestParam("retentionDays") Integer retentionDays) {
        recycleService.updateRetentionDays(loginUser, retentionDays);
        return Result.success(null);
    }
}
