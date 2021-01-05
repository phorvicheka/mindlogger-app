import * as R from "ramda";
import RNFetchBlob from "rn-fetch-blob";
import randomString from "random-string";
import {
  // getResponses,
  getLast7DaysData,
  postResponse,
  postFile,
} from "./network";
import { cleanFiles } from "./file";
import { transformResponses } from "../models/response";
import { decryptData } from "./encryption";
import {
  activityTransformJson,
  itemTransformJson,
  itemAttachExtras,
  ORDER,
} from "../models/json-ld";

export const downloadAllResponses = (authToken, applets, onProgress) => {
  let numDownloaded = 0;
  onProgress(numDownloaded, applets.length);
  const requests = applets.map((applet) => {
    const appletId = applet.id.split("/").pop();
    return getLast7DaysData({
      authToken,
      appletId,
      groupByDateActivity: false,
    }).then((responses) => {
      // console.log({responses},"res")
      numDownloaded += 1;
      onProgress(numDownloaded, applets.length);
      const appletId = applet.id;
      /** decrypt responses */
      if (responses.dataSources && applet.encryption) {
        Object.keys(responses.dataSources).forEach((key) => {
          try {
            responses.dataSources[key] = JSON.parse(
              decryptData({
                key: applet.AESKey,
                text: responses.dataSources[key],
              })
            );
          } catch {
            responses.dataSources[key] = {};
            responses.hasDecryptionError = true;
          }
        });
      }
      
      /** replace response to plain format */
      if (responses.responses) {
        Object.keys(responses.responses).forEach((item) => {
          for (let response of responses.responses[item]) {
            if (
              response.value &&
              response.value.src &&
              response.value.ptr !== undefined
            ) {
              response.value =
                responses.dataSources[response.value.src][0];
            }
          }

          responses.responses[item] = responses.responses[item].filter(
            (response) => response.value
          );
          if (responses.responses[item].length === 0) {
            delete responses.responses[item];
          }
        });
      }

      if (responses.items) {
        for (let itemId in responses.items) {
          const item = responses.items[itemId];
          responses.items[itemId] = {
            ...itemAttachExtras(itemTransformJson(item), itemId),
            original: item.original,
            activityId: item.activityId,
          };
        }
      }

      if (responses.itemReferences) {
        for (let version in responses.itemReferences) {
          for (let itemId in responses.itemReferences[version]) {
            const id = responses.itemReferences[version][itemId];
            if (id) {
              const item = responses.items[id];
              responses.itemReferences[version][itemId] = item;
            }
          }
        }
      }

      if (responses.activities) {
        for (let activityId in responses.activities) {
          const activity = responses.activities[activityId];
          if (activity[ORDER]) {
            delete activity[ORDER];
          }

          responses.activities[activityId] = {
            ...activityTransformJson(activity, []),
            original: activity.original,
          };
        }
      }

      if (responses.cumulatives) {
        Object.keys(responses.cumulatives).forEach((itemIRI) => {
          const cumulative = responses.cumulatives[itemIRI];
          if (
            cumulative.src &&
            cumulative.ptr !== undefined
          ) {
            cumulative.value = responses.dataSources[cumulative.src][cumulative.ptr];
          }

          const oldItem = responses.itemReferences[cumulative.version] && 
                          responses.itemReferences[cumulative.version][itemIRI];
          if ( oldItem ) {
            const currentActivity = applet.activities.find(activity => activity.id.split('/').pop() == oldItem.original.activityId)

            if (currentActivity) {
              const currentItem = activity.items.find(item => item.id.split('/').pop() === oldItem.original.screenId);

              if (currentItem && currentItem.schema !== itemIRI) {
                responses.cumulatives[currentItem.schema] = responses.cumulatives[itemIRI];

                delete responses.cumulatives[itemIRI];
              }
            }
          }
        })
      }

      return { ...responses, appletId };
    });
  });
  return Promise.all(requests).then(transformResponses);
};

const prepareFile = (file): Promise => {
  console.log('prepareFile', { file });
  if (file.svgString && file.uri) {
    console.log('RNFetchBlob.fs.writeFile', { file });
    return RNFetchBlob.fs.writeFile(file.uri, file.svgString)
      .then((result) => {
        console.log('RNFetchBlob.fs.writeFile result', { result, file });
        return Promise.resolve(file);
      }).then(file => RNFetchBlob.fs.stat(file.uri))
      .then(fileInfo => Promise.resolve({ ...file, size: fileInfo.size }));
  }
  if (file.size) {
    return Promise.resolve(file);
  }
  return RNFetchBlob.fs.stat(file.uri)
    .then(fileInfo => Promise.resolve({ ...file, size: fileInfo.size }));
};

const uploadFiles = (authToken, response, item) => {
  console.log({ item });
  const answers = R.pathOr([], ["responses"], response);
  console.log('uploadFiles', { response, item, answers });
  // Each "response" has number of "answers", each of which may have a file
  // associated with it
  const uploadRequests = Object.keys(answers).reduce((accumulator, key) => {
    const answer = answers[key];
    // Surveys with a "uri" value and canvas with a "uri" will have files to upload
    let file;
    if (R.path(["survey", "uri"], answer)) {
      file = {
        uri: answer.survey.uri,
        filename: answer.survey.filename,
        type: "application/octet",
      };
    } else if (R.path(["canvas", "uri"], answer)) {
      file = {
        uri: answer.canvas.uri,
        filename: answer.canvas.filename,
        type: "application/jpg",
      };
    } else if (answer && answer.uri && answer.filename) {
      file = {
        uri: answer.uri,
        filename: answer.filename,
        size: answer.size,
        type: 'application/octet',
      };
    } else if (answer && answer.lines && answer.svgString) {
      const filename = `${randomString({ length: 20 })}.svg`;
      file = {
        svgString: answer.svgString,
        filename,
        type: 'application/svg',
        uri: `${RNFetchBlob.fs.dirs.DocumentDir}/${filename}`,
      };
    } else {
      return accumulator; // Break early
    }
    console.log('uploadFiles, file', { file, answer });

    const request = prepareFile(file)
      .then(file => postFile({
        authToken,
        file,
        parentType: 'item',
        parentId: item._id,
      }))
      .then((res) => {
        console.log('uploadFiles, response:', { res });
        /** delete file from local storage after uploading */
        RNFetchBlob.fs.unlink(file.uri.split("///").pop());
      }).catch((err) => {
        console.log('uploadFiles error', err.message, { err });
      });

    console.log('uploadFiles, request', { request });

    return [...accumulator, request];
  }, []);
  console.log('uploadFiles uploadRequests', { uploadRequests });
  return Promise.all(uploadRequests);
};

const uploadResponse = (authToken, response) =>
  postResponse({
    authToken,
    response,
  })
    .then((item) => uploadFiles(authToken, response, item))
    .then(() => {
      const responses = R.pathOr([], ["payload", "responses"], response);
      console.log({ apiRes: responses });
      console.log({ resss: response });
      cleanFiles(responses);
    });

// Recursive function that tries to upload the first item in the queue and
// calls itself again on success
export const uploadResponseQueue = (
  authToken,
  responseQueue,
  progressCallback,
) => {
  if (responseQueue.length === 0) {
    return Promise.resolve();
  }
  console.log('uploadResponseQueue', { authToken, responseQueueItem: responseQueue[0] });
  return uploadResponse(authToken, responseQueue[0])
    .then(() => {
      progressCallback();
      return uploadResponseQueue(
        authToken,
        R.remove(0, 1, responseQueue),
        progressCallback,
      );
    })
    .catch((e) => console.warn(e));
};
