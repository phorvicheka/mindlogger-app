import { createSelector } from 'reselect';
import * as R from 'ramda';

export const responsesSelector = R.path(['responses', 'responseHistory']);

export const uploadQueueSelector = R.path(['responses', 'uploadQueue']);

export const isDownloadingResponsesSelector = R.path(['responses', 'isDownloadingResponses']);

export const downloadProgressSelector = R.path(['responses', 'downloadProgress']);

export const inProgressSelector = R.path(['responses', 'inProgress']);

// Flatten the response history so that keys are activity ids
export const responsesGroupedByActivitySelector = createSelector(
  responsesSelector,
  responses => R.groupBy(
    response => `activity/${response.meta.activity['@id']}`,
    responses,
  ),
);

export const currentResponsesSelector = createSelector(
  R.path(['app', 'currentActivity']),
  inProgressSelector,
  (activityId, inProgress) => inProgress[activityId],
);