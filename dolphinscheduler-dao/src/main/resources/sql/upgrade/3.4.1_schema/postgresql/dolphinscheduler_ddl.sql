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

CREATE SEQUENCE IF NOT EXISTS t_ds_task_instance_context_id_seq;
ALTER TABLE t_ds_task_instance_context
ALTER COLUMN id SET DEFAULT nextval('t_ds_task_instance_context_id_seq'::regclass);

-- workflow recycle bin: snapshot of a deleted workflow definition (DAG json) kept until retention expires
CREATE TABLE IF NOT EXISTS t_ds_workflow_recycle (
  id serial NOT NULL,
  workflow_code bigint NOT NULL,
  workflow_name varchar(255) DEFAULT NULL,
  project_code bigint NOT NULL,
  description text,
  task_count int DEFAULT 0,
  owner_user_id int DEFAULT NULL,
  delete_user_id int DEFAULT NULL,
  dag_json text,
  delete_time timestamp DEFAULT NULL,
  PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS workflow_recycle_idx_project_code ON t_ds_workflow_recycle (project_code);
CREATE INDEX IF NOT EXISTS workflow_recycle_idx_delete_time ON t_ds_workflow_recycle (delete_time);

-- global key/value settings editable in Security Center
CREATE TABLE IF NOT EXISTS t_ds_system_setting (
  setting_key varchar(64) NOT NULL,
  setting_value text DEFAULT NULL,
  update_time timestamp DEFAULT NULL,
  PRIMARY KEY (setting_key)
);

ALTER TABLE t_ds_system_setting ALTER COLUMN setting_value TYPE text;
