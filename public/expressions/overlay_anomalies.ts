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
  ExprVisLayers,
} from '../../../../src/plugins/expressions/public';
import {
  VisLayer,
  VisLayers,
  PointInTimeEvent,
  PointInTimeEventsVisLayer,
} from '../../../../src/plugins/visualizations/public';
import {
  Filter,
  Query,
  TimeRange,
  calculateBounds,
} from '../../../../src/plugins/data/common';
//import { getParsedValue } from '../../../../src/plugins/expressions/common';
import {
  getAnomalySummaryQuery,
  parsePureAnomalies,
} from '../pages/utils/anomalyResultUtils';
import { AD_NODE_API } from '../../utils/constants';
import { AnomalyData } from '../models/interfaces';
import { getClient } from '../services';

type Input = ExprVisLayers;
type Output = Promise<ExprVisLayers>;

interface Arguments {
  detectorId: string;
}

const name = 'overlay_anomalies';

export type OverlayAnomaliesExpressionFunctionDefinition =
  ExpressionFunctionDefinition<'overlay_anomalies', Input, Arguments, Output>;

const getAnomalies = async (
  detectorId: string,
  startTime: number,
  endTime: number
): Promise<AnomalyData[]> => {
  // get the raw anomalies + aggs (aggs may not be needed, but leave in for now)
  const anomalySummaryQuery = getAnomalySummaryQuery(
    startTime,
    endTime,
    detectorId,
    undefined,
    // regularly this should be false. setting to true to use historical
    // to quickly get some results
    // false
    true
  );

  // We set the http client in the plugin.ts setup() fn. We pull it in here to make a
  // server-side call directly.
  //
  // Note we can't use the redux fns here (e.g., searchResults()) since it requires
  // hooks (e.g., useDispatch()) which doesn't make sense in this context, plus is not allowed by React.
  const anomalySummaryResponse = await getClient().post(
    `..${AD_NODE_API.DETECTOR}/results/_search`,
    {
      body: JSON.stringify(anomalySummaryQuery),
    }
  );
  return parsePureAnomalies(anomalySummaryResponse);
};

const convertAnomaliesToLayer = (
  anomalies: AnomalyData[]
): PointInTimeEventsVisLayer => {
  const events = anomalies.map((anomaly: AnomalyData) => {
    return {
      timestamp: anomaly.startTime + (anomaly.endTime - anomaly.startTime) / 2,
      metadata: {},
    } as PointInTimeEvent;
  });
  return {
    name: 'anomaly-events',
    events: events,
    format: 'some-format',
  } as PointInTimeEventsVisLayer;
};

const appendAnomaliesToTable = (
  datatable: OpenSearchDashboardsDatatable,
  anomalies: AnomalyData[]
) => {
  const AD_COLUMN_ID = 'ad';
  const newDatatable = cloneDeep(datatable);

  // append a new column
  newDatatable.columns = [
    ...newDatatable.columns,
    {
      id: AD_COLUMN_ID,
      name: 'Anomaly',
    } as OpenSearchDashboardsDatatableColumn,
  ];

  // for each anomaly, find the correct time bucket it goes in and add the anomaly value there in the AD column
  // reverse it since the initial results are returned in reverse sequential order
  let rowIndex = 0;
  anomalies.reverse().forEach((anomaly: any) => {
    let found = false;
    while (rowIndex < newDatatable.rows.length - 1 && !found) {
      // assuming the first column in the rows data is the x-axis / timestamp values.
      // probably need to find a better way to guarantee this
      const startTs = newDatatable.rows[rowIndex][
        Object.keys(newDatatable.rows[rowIndex])[0]
      ] as number;
      const endTs = newDatatable.rows[rowIndex + 1][
        Object.keys(newDatatable.rows[rowIndex + 1])[0]
      ] as number;

      if (startTs <= anomaly.plotTime && endTs > anomaly.plotTime) {
        // adding hacky soln of choosing the first y-series data to overlay anomaly spike
        // this is strictly for making it easier to show correlation of the data w/ the anomaly
        const firstYVal = newDatatable.rows[rowIndex][
          Object.keys(newDatatable.rows[rowIndex])[1]
        ] as number;
        newDatatable.rows[rowIndex] = {
          ...newDatatable.rows[rowIndex],
          [AD_COLUMN_ID]: firstYVal,
        };
        found = true;
      } else {
        rowIndex++;
      }
    }
  });
  return newDatatable;
};

const appendAdDimensionToConfig = (
  visConfig: any,
  datatable: OpenSearchDashboardsDatatable
) => {
  const config = cloneDeep(visConfig);

  // the AD column is appended last. All previous dimensions are incremented sequentially starting from 0.
  // So given 1 x-axis column (accessor=0), 1 y-axis metric column (accessor=1), and 1 y-axis AD column,
  // the accessor should be 2 (column length -1).
  const adAccessor = datatable.columns.length - 1;

  // TODO: see if this has changed to 'metric' based on new vis schemas
  config.dimensions.y.push({
    accessor: adAccessor,
    //aggType: 'avg',
    format: {},
    label: 'Anomaly',
    params: {},
  });

  return config;
};

export const overlayAnomaliesFunction =
  (): OverlayAnomaliesExpressionFunctionDefinition => ({
    name,
    type: 'vis_layers',
    inputTypes: ['vis_layers'],
    help: i18n.translate('data.functions.overlay_anomalies.help', {
      defaultMessage: 'Add an anomaly vis layer',
    }),
    args: {
      detectorId: {
        types: ['string'],
        default: '""',
        help: '',
      },
    },

    async fn(input, args, context): Promise<ExprVisLayers> {
      // Parsing all of the args & input
      const detectorId = get(args, 'detectorId', '');
      const timeRange = get(
        context,
        'searchContext.timeRange',
        ''
      ) as TimeRange;
      const origVisLayers = get(input, 'layers', {
        layers: [] as VisLayers,
      }) as VisLayers;
      const parsedTimeRange = timeRange ? calculateBounds(timeRange) : null;
      const startTimeInMillis = parsedTimeRange?.min?.unix()
        ? parsedTimeRange?.min?.unix() * 1000
        : undefined;
      const endTimeInMillis = parsedTimeRange?.max?.unix()
        ? parsedTimeRange?.max?.unix() * 1000
        : undefined;

      // making sure we can actually fetch anomalies. if not just stop here and return.
      // TODO: throw all of this in a try/catch maybe
      if (startTimeInMillis === undefined || endTimeInMillis === undefined) {
        console.log('start or end time invalid');
        return {
          type: 'vis_layers',
          layers: origVisLayers,
        };
      }

      const anomalies = await getAnomalies(
        detectorId,
        startTimeInMillis,
        endTimeInMillis
      );

      const anomalyLayer = convertAnomaliesToLayer(anomalies);

      // const augmentedTable = appendAnomaliesToTable(origDatatable, anomalies);
      // const updatedVisConfig = appendAdDimensionToConfig(
      //   origVisConfig,
      //   augmentedTable
      // );

      // const table: OpenSearchDashboardsdatatable = {
      //   type: 'opensearch_dashboards_datatable',
      //   rows: augmentedTable.rows,
      //   columns: augmentedTable.columns.map((column: any) => {
      //     const cleanedColumn: OpenSearchDashboardsdatatableColumn = {
      //       id: column.id,
      //       name: column.name,
      //       meta: serializeAggConfig(column.aggConfig),
      //     };
      //     if (args.includeFormatHints) {
      //       cleanedColumn.formatHint =
      //         column.aggConfig.toSerializedFieldFormat();
      //     }
      //     return cleanedColumn;
      //   }),
      // };

      // adding the anomaly layer to the list of VisLayers
      return {
        type: 'vis_layers',
        layers: origVisLayers
          ? origVisLayers.concat(anomalyLayer)
          : [anomalyLayer],
      };
    },
  });
