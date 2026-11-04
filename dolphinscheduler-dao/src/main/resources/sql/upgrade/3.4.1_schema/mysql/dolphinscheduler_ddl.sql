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

ALTER TABLE `t_ds_serial_command`
MODIFY COLUMN `workflow_definition_code` BIGINT(20) NOT NULL COMMENT 'workflow definition code';
-- workflow recycle bin: snapshot of a deleted workflow definition (DAG json) kept until retention expires
CREATE TABLE IF NOT EXISTS `t_ds_workflow_recycle` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT "key",
  `workflow_code` bigint NOT NULL COMMENT "workflow definition code",
  `workflow_name` varchar(255) DEFAULT NULL COMMENT "workflow name",
  `project_code` bigint NOT NULL COMMENT "project code",
  `description` text COMMENT "description",
  `task_count` int DEFAULT 0 COMMENT "task count",
  `owner_user_id` int DEFAULT NULL COMMENT "original owner",
  `delete_user_id` int DEFAULT NULL COMMENT "who deleted it",
  `dag_json` longtext COMMENT "DagDataSchedule json snapshot",
  `delete_time` datetime DEFAULT NULL COMMENT "delete time",
  PRIMARY KEY (`id`),
  KEY `workflow_recycle_idx_project_code` (`project_code`),
  KEY `workflow_recycle_idx_delete_time` (`delete_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- global key/value settings editable in Security Center
CREATE TABLE IF NOT EXISTS `t_ds_system_setting` (
  `setting_key` varchar(64) NOT NULL COMMENT "key",
  `setting_value` longtext COMMENT "value",
  `update_time` datetime DEFAULT NULL COMMENT "update time",
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

ALTER TABLE `t_ds_system_setting` MODIFY COLUMN `setting_value` longtext COMMENT "value";
