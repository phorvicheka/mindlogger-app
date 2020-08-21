import * as R from 'ramda';
import moment from 'moment';

const compareByNameAlpha = (a, b) => {
  const nameA = a.name.en.toUpperCase(); // ignore upper and lowercase
  const nameB = b.name.en.toUpperCase(); // ignore upper and lowercase
  if (nameA < nameB) {
    return -1;
  }
  if (nameA > nameB) {
    return 1;
  }
  return 0;
};

const compareByTimestamp = propName => (a, b) => moment(a[propName]) - moment(b[propName]);

export const getUnscheduled = activityList => activityList.filter(
  activity => (!activity.nextScheduledTimestamp || !moment().isSame(moment(activity.nextScheduledTimestamp), 'day'))
    && (!activity.oneTimeCompletion || !activity.lastResponseTimestamp || moment(activity.lastResponseTimestamp) < activity.lastScheduledTimestamp)
    && (!activity.lastResponseTimestamp || !moment().isSame(moment(activity.lastResponseTimestamp), 'day') || (new Date(activity.lastResponseTimestamp).getTime() - activity.lastScheduledTimestamp > activity.lastTimeout) || (new Date(activity.lastResponseTimestamp).getTime() < activity.lastScheduledTimestamp))
    && (!activity.lastScheduledTimestamp || (new Date().getTime() - activity.lastScheduledTimestamp > activity.lastTimeout && !moment().isSame(moment(activity.lastScheduledTimestamp), 'day')))
    && activity.invalid !== false,
);

// export const getCompleted = activityList => activityList.filter(
//   activity => activity.lastResponseTimestamp !== null
//     && activity.nextScheduledTimestamp === null
//     && (!moment().isSame(moment(activity.lastResponseTimestamp), 'day')),
// );

export const getScheduled = activityList => activityList.filter(
  activity => activity.nextScheduledTimestamp
    && (!activity.lastScheduledTimestamp || new Date().getTime() - activity.lastScheduledTimestamp > activity.lastTimeout || moment(activity.lastResponseTimestamp) > activity.lastScheduledTimestamp)
    && (activity.nextAccess || moment().isSame(moment(activity.nextScheduledTimestamp), 'day'))
    && !(activity.nextAccess && moment().isSame(moment(activity.lastResponseTimestamp), 'day')),
);

export const getPastdue = activityList => activityList.filter(
  activity => activity.lastScheduledTimestamp
    && activity.lastTimeout
    && (!activity.lastResponseTimestamp || moment(activity.lastResponseTimestamp) < activity.lastScheduledTimestamp || (new Date(activity.lastResponseTimestamp).getTime() - activity.lastScheduledTimestamp > activity.lastTimeout))
    && (new Date().getTime() - activity.lastScheduledTimestamp <= activity.lastTimeout),
);

const addSectionHeader = (array, headerText) => (array.length > 0
  ? [{ isHeader: true, text: headerText }, ...array]
  : []);

const addProp = (key, val, arr) => arr.map(obj => R.assoc(key, val, obj));

// Sort the activities into categories and inject header labels, e.g. "In Progress",
// before the activities that fit into that category.
export default (appletId, activityList, inProgress, schedule) => {
  console.log('%%----->', activityList);
  const inProgressKeys = Object.keys(inProgress);
  const inProgressActivities = activityList.filter(
    activity => inProgressKeys.includes(appletId + activity.id),
  );
  const notInProgress = inProgressKeys ? activityList.filter(activity => !inProgressKeys.includes(appletId + activity.id)) : activityList;
  // Activities currently scheduled - or - previously scheduled and not yet completed.

  // Activities scheduled some time in the future.
  const pastdue = getPastdue(notInProgress).sort(compareByTimestamp('lastScheduledTimestamp')).reverse();

  const scheduled = getScheduled(notInProgress).sort(compareByTimestamp('nextScheduledTimestamp'));

  // Activities with no schedule.
  const unscheduled = getUnscheduled(notInProgress).sort(compareByNameAlpha);

  // Activities which have been completed and have no more scheduled occurrences.
  // const completed = getCompleted(notInProgress).reverse();

  return [
    ...addSectionHeader(addProp('status', 'pastdue', pastdue), 'Past Due'),
    ...addSectionHeader(addProp('status', 'in-progress', inProgressActivities), 'In Progress'),
    ...addSectionHeader(addProp('status', 'unscheduled', unscheduled), 'Unscheduled'),
    // ...addSectionHeader(addProp('status', 'completed', completed), 'Completed'),
    ...addSectionHeader(addProp('status', 'scheduled', scheduled), 'Scheduled'),
  ];
};
