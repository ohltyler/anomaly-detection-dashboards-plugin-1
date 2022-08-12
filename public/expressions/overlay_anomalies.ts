/*
 * SPDX-License-Identifier: Apache-2.0
 *
 * The OpenSearch Contributors require contributions made to
 * this file be licensed under the Apache-2.0 license or a
 * compatible open source license.
 *
 * Any modifications Copyright OpenSearch Contributors. See
 * GitHub history for details.
 */

/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { get, cloneDeep } from 'lodash';
import { i18n } from '@osd/i18n';
import {
  OpenSearchDashboardsDatatable,
  OpenSearchDashboardsDatatableRow,
  OpenSearchDashboardsDatatableColumn,
  ExpressionFunctionDefinition,
} from '../../../../src/plugins/expressions/public';
import { Filter, Query } from '../../../../src/plugins/data/common';
import { getParsedValue } from '../../../../src/plugins/expressions/common';

type Input = OpenSearchDashboardsDatatable;
type Output = Promise<OpenSearchDashboardsDatatable>;

interface Arguments {
  context: string | null;
}

const name = 'overlay_anomalies';

export type OverlayAnomaliesExpressionFunctionDefinition =
  ExpressionFunctionDefinition<'overlay_anomalies', Input, Arguments, Output>;

const appendAnomaliesToTable = (
  dataTable: OpenSearchDashboardsDatatable,
  anomalies: any[]
) => {
  const AD_COLUMN_ID = 'ad';
  const newDataTable = cloneDeep(dataTable);
  //   console.log('newDataTable (before): ', newDataTable);
  //   console.log('anomalies: ', anomalies);

  //   // append a new column
  //   newDataTable.columns = [
  //     ...newDataTable.columns,
  //     {
  //       id: AD_COLUMN_ID,
  //       name: 'Anomaly',
  //     } as OpenSearchDashboardsDatatableColumn,
  //   ];

  //   // for each anomaly, find the correct time bucket it goes in and add the anomaly value there in the AD column
  //   // reverse it since the initial results are returned in reverse sequential order
  //   let rowIndex = 0;
  //   anomalies.reverse().forEach((anomaly: any) => {
  //     let found = false;
  //     while (rowIndex < newDataTable.rows.length - 1 && !found) {
  //       // assuming the first column in the rows data is the x-axis / timestamp values.
  //       // probably need to find a better way to guarantee this
  //       const startTs = newDataTable.rows[rowIndex][
  //         Object.keys(newDataTable.rows[rowIndex])[0]
  //       ] as number;
  //       const endTs = newDataTable.rows[rowIndex + 1][
  //         Object.keys(newDataTable.rows[rowIndex + 1])[0]
  //       ] as number;

  //       if (startTs <= anomaly.plotTime && endTs > anomaly.plotTime) {
  //         // adding hacky soln of choosing the first y-series data to overlay anomaly spike
  //         // this is strictly for making it easier to show correlation of the data w/ the anomaly
  //         const firstYVal = newDataTable.rows[rowIndex][
  //           Object.keys(newDataTable.rows[rowIndex])[1]
  //         ] as number;
  //         newDataTable.rows[rowIndex] = {
  //           ...newDataTable.rows[rowIndex],
  //           [AD_COLUMN_ID]: firstYVal,
  //         };
  //         found = true;
  //       } else {
  //         rowIndex++;
  //       }
  //     }
  //   });
  //   console.log('newDataTable (after): ', newDataTable);
  return newDataTable;
};

export const overlayAnomaliesFunction =
  (): OverlayAnomaliesExpressionFunctionDefinition => ({
    name,
    type: 'opensearch_dashboards_datatable',
    inputTypes: ['opensearch_dashboards_datatable'],
    help: i18n.translate('data.functions.overlay_anomalies.help', {
      defaultMessage: 'Overlays anomaly results on an existing datatable',
    }),
    args: {
      context: {
        types: ['string', 'null'],
        default: '{}',
        help: '',
      },
    },
    async fn(input, args) {
      const context = getParsedValue(args.context, {});
      const query = get(context, 'query', {}) as Query;
      const filters = get(context, 'filters', []) as Filter[];

      console.log('in overlay_anomalies expr fn');
      console.log('query: ', query);
      console.log('filters: ', filters);

      const augmentedTable = appendAnomaliesToTable(input, []);

      //   const table: OpenSearchDashboardsDatatable = {
      //     type: 'opensearch_dashboards_datatable',
      //     rows: augmentedTable.rows,
      //     columns: augmentedTable.columns.map((column: any) => {
      //       const cleanedColumn: OpenSearchDashboardsDatatableColumn = {
      //         id: column.id,
      //         name: column.name,
      //         meta: serializeAggConfig(column.aggConfig),
      //       };
      //       if (args.includeFormatHints) {
      //         cleanedColumn.formatHint =
      //           column.aggConfig.toSerializedFieldFormat();
      //       }
      //       return cleanedColumn;
      //     }),
      //   };

      return augmentedTable;
    },
  });
