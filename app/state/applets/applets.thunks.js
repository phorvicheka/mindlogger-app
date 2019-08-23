import { getApplets, registerOpenApplet, getAppletInvites, acceptAppletInvite } from '../../services/network';
import { scheduleNotifications } from '../../services/pushNotifications';
import { downloadResponses } from '../responses/responses.thunks';
import { downloadAppletsMedia } from '../media/media.thunks';
import { activitiesSelector } from './applets.selectors';
import { authSelector, userInfoSelector, loggedInSelector } from '../user/user.selectors';
import {
  setNotifications,
  setDownloadingApplets,
  replaceApplets,
  setInvites,
} from './applets.actions';
import { transformApplet } from '../../models/json-ld';

export const scheduleAndSetNotifications = () => (dispatch, getState) => {
  const state = getState();
  const activities = activitiesSelector(state);
  // This call schedules the notifications and returns a list of scheduled notifications
  const updatedNotifications = scheduleNotifications(activities);
  console.log('dispatching set notifications', activities, updatedNotifications);
  dispatch(setNotifications(updatedNotifications));
};

export const getInvitations = () => (dispatch, getState) => {
  const state = getState();
  const auth = authSelector(state);
  getAppletInvites(auth.token).then((invites) => {
    console.log('setting applet invites', invites);
    dispatch(setInvites(invites));
  }).catch((e) => {
    console.warn(e);
  });
};


export const downloadApplets = () => (dispatch, getState) => {
  const state = getState();
  const auth = authSelector(state);
  const userInfo = userInfoSelector(state);
  dispatch(setDownloadingApplets(true));
  getApplets(auth.token, userInfo._id).then((applets) => {
    if (loggedInSelector(getState())) { // Check that we are still logged in when fetch finishes
      const transformedApplets = applets.map(applet => transformApplet(applet));
      dispatch(replaceApplets(transformedApplets));
      dispatch(downloadResponses(transformedApplets));
      dispatch(downloadAppletsMedia(transformedApplets));
    }
  }).finally(() => {
    dispatch(setDownloadingApplets(false));
    dispatch(scheduleAndSetNotifications());
    dispatch(getInvitations());
  });
};

export const acceptInvitation = inviteId => (dispatch, getState) => {
  const state = getState();
  const auth = authSelector(state);
  return acceptAppletInvite(auth.token, inviteId).then(() => {
    dispatch(getInvitations());
    dispatch(downloadApplets());
  });
};

export const joinOpenApplet = appletURI => (dispatch, getState) => {
  dispatch(setDownloadingApplets(true));
  const state = getState();
  const auth = authSelector(state);
  registerOpenApplet(
    auth.token,
    appletURI,
  )
    .then(() => {
      dispatch(downloadApplets());
    })
    .catch((e) => {
      console.warn(e);
    });
};
