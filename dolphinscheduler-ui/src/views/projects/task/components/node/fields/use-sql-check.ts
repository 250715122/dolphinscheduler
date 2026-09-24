import { useI18n } from 'vue-i18n'
import { useCustomParams } from '.'
import type { IJsonItem } from '../types'

export function useSqlCheck(model: { [field: string]: any }): IJsonItem[] {
  const { t } = useI18n()
  return [
    {
      type: 'input',
      field: 'checkName',
      name: t('project.node.sql_check_name'),
      props: {
        placeholder: t('project.node.sql_check_name_tips')
      }
    },
    {
      type: 'editor',
      field: 'sql',
      name: t('project.node.sql_check_sql'),
      validate: {
        trigger: ['input', 'trigger'],
        required: true,
        message: t('project.node.sql_empty_tips')
      },
      props: {
        language: 'sql'
      }
    },
    {
      type: 'select',
      field: 'operator',
      name: t('project.node.sql_check_operator'),
      options: [
        { label: '>  (GT)', value: 'GT' },
        { label: '>= (GE)', value: 'GE' },
        { label: '<  (LT)', value: 'LT' },
        { label: '<= (LE)', value: 'LE' },
        { label: '=  (EQ)', value: 'EQ' },
        { label: '!= (NE)', value: 'NE' }
      ],
      validate: {
        required: true,
        trigger: ['change']
      }
    },
    {
      type: 'input-number',
      field: 'threshold',
      name: t('project.node.sql_check_threshold'),
      props: {
        placeholder: t('project.node.sql_check_threshold_tips')
      },
      validate: {
        required: true,
        trigger: ['blur', 'input']
      }
    },
    ...useCustomParams({
      model,
      field: 'localParams',
      isSimple: model.readonly
    })
  ]
}
