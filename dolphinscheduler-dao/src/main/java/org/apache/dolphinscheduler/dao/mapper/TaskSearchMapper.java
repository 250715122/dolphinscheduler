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

package org.apache.dolphinscheduler.dao.mapper;

import org.apache.dolphinscheduler.dao.entity.TaskSearchItem;

import java.util.List;

import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/**
 * Global task search: find task definitions by name across projects and tell which project/workflow they live in.
 * Only the CURRENT workflow version is considered, so tasks that exist only in old versions are not returned.
 */
public interface TaskSearchMapper {

    @Select({
            "<script>",
            "select t.code as taskCode, t.name as taskName, t.task_type as taskType,",
            "       w.code as workflowCode, w.name as workflowName, w.release_state as releaseState,",
            "       p.code as projectCode, p.name as projectName",
            "from t_ds_task_definition t",
            "join t_ds_workflow_task_relation r",
            "  on r.post_task_code = t.code and r.post_task_version = t.version",
            "join t_ds_workflow_definition w",
            "  on w.code = r.workflow_definition_code and w.version = r.workflow_definition_version",
            "join t_ds_project p on p.code = w.project_code",
            "where lower(t.name) like lower(concat('%', #{keyword}, '%'))",
            "<if test='projectCodes != null'>",
            "  and p.code in",
            "  <foreach collection='projectCodes' item='c' open='(' separator=',' close=')'>#{c}</foreach>",
            "</if>",
            "order by (case when lower(t.name) = lower(#{keyword}) then 0 else 1 end), t.name, p.name",
            "limit #{limit}",
            "</script>"
    })
    List<TaskSearchItem> search(@Param("keyword") String keyword,
                                @Param("projectCodes") List<Long> projectCodes,
                                @Param("limit") int limit);
}
