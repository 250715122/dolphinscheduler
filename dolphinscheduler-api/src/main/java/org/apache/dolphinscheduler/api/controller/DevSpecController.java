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

import org.apache.dolphinscheduler.api.enums.Status;
import org.apache.dolphinscheduler.api.exceptions.ApiException;
import org.apache.dolphinscheduler.api.exceptions.ServiceException;
import org.apache.dolphinscheduler.api.utils.Result;
import org.apache.dolphinscheduler.common.constants.Constants;
import org.apache.dolphinscheduler.common.enums.UserType;
import org.apache.dolphinscheduler.dao.entity.SystemSetting;
import org.apache.dolphinscheduler.dao.entity.User;
import org.apache.dolphinscheduler.dao.mapper.SystemSettingMapper;

import java.util.Date;
import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * Development standards shown in the navbar: every logged-in user can read, only admins can edit.
 * Content is markdown stored in t_ds_system_setting; empty means "use the built-in default in the UI".
 */
@Tag(name = "DEV_SPEC_TAG")
@RestController
@RequestMapping("/system-settings/dev-spec")
public class DevSpecController extends BaseController {

    static final String KEY_CONTENT = "dev.spec.content";
    static final String KEY_UPDATER = "dev.spec.updater";
    private static final int MAX_LENGTH = 200_000;

    @Autowired
    private SystemSettingMapper settingMapper;

    @GetMapping
    @ResponseStatus(HttpStatus.OK)
    @ApiException(Status.INTERNAL_SERVER_ERROR_ARGS)
    public Result<Map<String, Object>> get(@Parameter(hidden = true) @RequestAttribute(value = Constants.SESSION_USER) User loginUser) {
        SystemSetting content = settingMapper.selectById(KEY_CONTENT);
        SystemSetting updater = settingMapper.selectById(KEY_UPDATER);
        Map<String, Object> m = new HashMap<>();
        m.put("content", content == null ? null : content.getSettingValue());
        m.put("updateTime", content == null ? null : content.getUpdateTime());
        m.put("updater", updater == null ? null : updater.getSettingValue());
        m.put("editable", loginUser.getUserType() == UserType.ADMIN_USER);
        return Result.success(m);
    }

    @PutMapping
    @ResponseStatus(HttpStatus.OK)
    @ApiException(Status.INTERNAL_SERVER_ERROR_ARGS)
    public Result update(@Parameter(hidden = true) @RequestAttribute(value = Constants.SESSION_USER) User loginUser,
                         @RequestParam(value = "content", required = false) String content) {
        if (loginUser.getUserType() != UserType.ADMIN_USER) {
            throw new ServiceException(Status.USER_NO_OPERATION_PERM);
        }
        if (content != null && content.length() > MAX_LENGTH) {
            throw new ServiceException(Status.REQUEST_PARAMS_NOT_VALID_ERROR, "content too long");
        }
        Date now = new Date();
        upsert(KEY_CONTENT, content, now);
        upsert(KEY_UPDATER, loginUser.getUserName(), now);
        return Result.success(null);
    }

    private void upsert(String key, String value, Date now) {
        SystemSetting s = settingMapper.selectById(key);
        if (s == null) {
            s = new SystemSetting();
            s.setSettingKey(key);
            s.setSettingValue(value);
            s.setUpdateTime(now);
            settingMapper.insert(s);
        } else {
            s.setSettingValue(value);
            s.setUpdateTime(now);
            settingMapper.updateById(s);
        }
    }
}
