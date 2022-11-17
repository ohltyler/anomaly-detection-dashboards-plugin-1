/*
 * SPDX-License-Identifier: Apache-2.0
 *
 * The OpenSearch Contributors require contributions made to
 * this file be licensed under the Apache-2.0 license or a
 * compatible open source license.
 *
 * Modifications Copyright OpenSearch Contributors. See
 * GitHub history for details.
 */

import {
  AppMountParameters,
  CoreSetup,
  CoreStart,
  Plugin,
  PluginInitializerContext,
} from '../../../src/core/public';
import {
  AnomalyDetectionOpenSearchDashboardsPluginSetup,
  AnomalyDetectionOpenSearchDashboardsPluginStart,
} from '.';
import {
  ExpressionsSetup,
  ExpressionsStart,
} from '../../../src/plugins/expressions/public';
import { overlayAnomaliesFunction } from './expressions';
import {
  DataPublicPluginSetup,
  DataPublicPluginStart,
} from '../../../src/plugins/data/public';
import { createSavedFeatureAnywhereLoader } from '../../../src/plugins/visualizations/public';
import {
  setSearchService,
  setClient,
  setSavedFeatureAnywhereLoader,
} from './services';

export interface AnomalyDetectionOpenSearchDashboardsPluginSetupDeps {
  expressions: ExpressionsSetup;
  data: DataPublicPluginSetup;
}

// TODO: may not need expressions. See comment above start().
export interface AnomalyDetectionOpenSearchDashboardsPluginStartDeps {
  expressions: ExpressionsStart;
  data: DataPublicPluginStart;
}

export class AnomalyDetectionOpenSearchDashboardsPlugin
  implements
    Plugin<
      AnomalyDetectionOpenSearchDashboardsPluginSetup,
      AnomalyDetectionOpenSearchDashboardsPluginStart,
      AnomalyDetectionOpenSearchDashboardsPluginSetupDeps,
      AnomalyDetectionOpenSearchDashboardsPluginStartDeps
    >
{
  constructor(private readonly initializerContext: PluginInitializerContext) {
    // can retrieve config from initializerContext
  }

  public setup(
    core: CoreSetup<
      AnomalyDetectionOpenSearchDashboardsPluginStartDeps,
      AnomalyDetectionOpenSearchDashboardsPluginStart
    >,
    { expressions, data }: AnomalyDetectionOpenSearchDashboardsPluginSetupDeps
  ): AnomalyDetectionOpenSearchDashboardsPluginSetup {
    core.application.register({
      id: 'anomaly-detection-dashboards',
      title: 'Anomaly Detection',
      category: {
        id: 'opensearch',
        label: 'OpenSearch Plugins',
        order: 2000,
      },
      order: 5000,
      mount: async (params: AppMountParameters) => {
        const { renderApp } = await import('./anomaly_detection_app');
        const [coreStart, depsStart] = await core.getStartServices();
        return renderApp(coreStart, params);
      },
    });

    // Register the expression fn to overlay anomalies on a given datatable
    expressions.registerFunction(overlayAnomaliesFunction);

    // Set the HTTP client so it can be pulled into expression fns to make
    // direct server-side calls
    setClient(core.http);

    return {};
  }

  // May not need to do the common pattern of setExpressions(expressions) here, which is used to
  // populate a bunch of getters/setters in a services.ts file, to fetch the services when used in downstream components
  // ex: setExpressions() here, then use getExpressions() to execute some expressions fn in some react component
  public start(
    core: CoreStart,
    { expressions, data }: AnomalyDetectionOpenSearchDashboardsPluginStartDeps
  ): AnomalyDetectionOpenSearchDashboardsPluginStart {
    // TODO: as of now, we aren't using this search service. Keep for now in case
    // it will be needed later (to construct SearchSources, for example).
    setSearchService(data.search);

    // Generate the feature anywhere loader
    // TODO: this may be imported from somewhere other than visualizations later on
    const savedFeatureAnywhereLoader = createSavedFeatureAnywhereLoader({
      savedObjectsClient: core.savedObjects.client,
      indexPatterns: data.indexPatterns,
      search: data.search,
      chrome: core.chrome,
      overlays: core.overlays,
    });
    setSavedFeatureAnywhereLoader(savedFeatureAnywhereLoader);

    return {};
  }
}
