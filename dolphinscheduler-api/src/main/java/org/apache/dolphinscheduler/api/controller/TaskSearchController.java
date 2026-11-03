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
import org.apache.dolphinscheduler.api.utils.Result;
import org.apache.dolphinscheduler.common.constants.Constants;
import org.apache.dolphinscheduler.common.enums.UserType;
import org.apache.dolphinscheduler.dao.entity.Project;
import org.apache.dolphinscheduler.dao.entity.TaskSearchItem;
import org.apache.dolphinscheduler.dao.entity.User;
import org.apache.dolphinscheduler.dao.mapper.ProjectMapper;
import org.apache.dolphinscheduler.dao.mapper.TaskSearchMapper;

import org.apache.commons.lang3.StringUtils;

import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * Global task search across every project the caller can access.
 */
@Tag(name = "TASK_SEARCH_TAG")
@RestController
@RequestMapping("/task-search")
public class TaskSearchController extends BaseController {

    private static final int MAX_LIMIT = 50;

    @Autowired
    private TaskSearchMapper taskSearchMapper;

    @Autowired
    private ProjectMapper projectMapper;

    @GetMapping
    @ResponseStatus(HttpStatus.OK)
    @ApiException(org.apache.dolphinscheduler.api.enums.Status.INTERNAL_SERVER_ERROR_ARGS)
    public Result<List<TaskSearchItem>> search(@Parameter(hidden = true) @RequestAttribute(value = Constants.SESSION_USER) User loginUser,
                                               @RequestParam("keyword") String keyword,
                                               @RequestParam(value = "limit", required = false, defaultValue = "20") Integer limit) {
        String kw = StringUtils.trimToEmpty(keyword);
        if (kw.length() < 2) {
            // avoid scanning everything on a single character
            return Result.success(Collections.emptyList());
        }
        int lim = Math.max(1, Math.min(limit == null ? 20 : limit, MAX_LIMIT));
        // escape LIKE wildcards so a literal % or _ in the keyword is not treated as a pattern
        String escaped = kw.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");

        List<Long> projectCodes = null;
        if (loginUser.getUserType() != UserType.ADMIN_USER) {
            List<Project> projects = projectMapper.queryProjectCreatedAndAuthorizedByUserId(loginUser.getId());
            if (projects == null || projects.isEmpty()) {
                return Result.success(Collections.emptyList());
            }
            projectCodes = projects.stream().map(Project::getCode).collect(Collectors.toList());
        }
        return Result.success(taskSearchMapper.search(escaped, projectCodes, lim));
    }
}
