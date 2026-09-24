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

package org.apache.dolphinscheduler.api.security.impl.sso;

import org.apache.dolphinscheduler.api.security.impl.AbstractSsoAuthenticator;
import org.apache.dolphinscheduler.api.service.UsersService;
import org.apache.dolphinscheduler.common.constants.Constants;
import org.apache.dolphinscheduler.common.enums.UserType;
import org.apache.dolphinscheduler.dao.entity.User;

import java.security.MessageDigest;
import java.util.UUID;

import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServletRequest;

import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;

import org.casbin.casdoor.entity.CasdoorUser;
import org.casbin.casdoor.service.CasdoorAuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * Casdoor SSO authenticator with native password login fallback.
 * SSO callback posts UUID state as userName and OAuth code as password;
 * otherwise credentials are treated as DolphinScheduler username/password.
 */
@Slf4j
public class CasdoorAuthenticator extends AbstractSsoAuthenticator {

    @Autowired
    private UsersService usersService;
    @Autowired
    private CasdoorAuthService casdoorAuthService;
    @Value("${casdoor.redirect-url}")
    private String redirectUrl;
    @Value("${security.authentication.casdoor.user.admin:#{null}}")
    private String adminUserName;

    @Override
    public User login(@NonNull String userName, String passwordOrCode) {
        if (!isSsoCallback(userName)) {
            return usersService.queryUser(userName, passwordOrCode);
        }
        return loginWithCasdoor(userName, passwordOrCode);
    }

    private User loginWithCasdoor(String state, String code) {
        ServletRequestAttributes servletRequestAttributes =
                (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (servletRequestAttributes == null) {
            return null;
        }
        HttpServletRequest request = servletRequestAttributes.getRequest();
        String originalState = (String) request.getSession().getAttribute(Constants.SSO_LOGIN_USER_STATE);
        if (originalState == null) {
            Cookie[] cookies = request.getCookies();
            if (cookies != null) {
                for (Cookie cookie : cookies) {
                    if (Constants.SSO_LOGIN_USER_STATE.equals(cookie.getName())
                            && cookie.getValue() != null && !cookie.getValue().isEmpty()) {
                        originalState = cookie.getValue();
                        log.warn("Casdoor SSO state recovered from cookie (HttpSession missing).");
                        break;
                    }
                }
            }
        }
        // one-time use
        request.getSession().removeAttribute(Constants.SSO_LOGIN_USER_STATE);
        // Check state to protect from CSRF attack
        if (originalState == null || state == null
                || !MessageDigest.isEqual(originalState.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                        state.getBytes(java.nio.charset.StandardCharsets.UTF_8))) {
            log.error("Casdoor SSO state mismatch. sessionStatePresent={}, callbackState={}",
                    originalState != null, state);
            return null;
        }

        String token = casdoorAuthService.getOAuthToken(code, state);
        CasdoorUser casdoorUser = casdoorAuthService.parseJwtToken(token);
        User user = null;
        if (casdoorUser.getName() != null) {
            user = usersService.getUserByUserName(casdoorUser.getName());
            if (user == null) {
                // Prefer Chinese display name when Casdoor name is an opaque id,
                // but keep Casdoor name as DS username for stable identity.
                user = usersService.createUser(getUserType(casdoorUser.getName()), casdoorUser.getName(),
                        casdoorUser.getEmail());
            }
        }
        return user;
    }

    /**
     * SSO callback uses UUID.randomUUID() as state (posted as userName).
     */
    static boolean isSsoCallback(String userName) {
        if (userName == null || userName.length() != 36) {
            return false;
        }
        try {
            UUID.fromString(userName);
            return true;
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }

    public UserType getUserType(String userName) {
        return adminUserName != null && adminUserName.equalsIgnoreCase(userName)
                ? UserType.ADMIN_USER
                : UserType.GENERAL_USER;
    }

    @Override
    public String getSignInUrl(String state) {
        return casdoorAuthService.getSigninUrl(redirectUrl, state);
    }

}
