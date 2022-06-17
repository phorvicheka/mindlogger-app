import React, { useState, useRef, useEffect, Component } from 'react';
import PropTypes from 'prop-types';
import { Text, StyleSheet, View, Platform, ActivityIndicator, NativeModules, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { sendData } from "../../services/socket";
import FlankerView from './FlankerView';

const htmlSource = require('./visual-stimulus-response.html');

const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const getImage = (image, alt) => {
  if (image) {
    return `<img src="${image}" alt="${alt}">`
  }

  return alt;
}

const getTrials = (stimulusScreens, blocks, buttons, samplingMethod) => {
  const trials = [];
  const choices = buttons.map(button => ({
    value: button.value,
    name: { en: getImage(button.image, button.name.en) }
  }));

  for (const block of blocks) {
    const order = samplingMethod == 'randomize-order' ? shuffle([...block.order]) : block.order;

    for (const item of order) {
      const screen = stimulusScreens.find(screen => screen.id == item);
      if (screen) {
        trials.push({
          ...screen,
          choices
        });
      }
    }
  }

  return trials;
}

export const VisualStimulusResponse = ({ onChange, config, isCurrent, appletId }) => {
  const [tryIndex, setTryIndex] = useState(1);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(1);
  const webView = useRef();

  let onEndGame = (result: Object) => {
    const dataString = result.nativeEvent.data;
    const dataObject = JSON.parse(dataString);

    const dataType = result.nativeEvent.type;

    if (dataType == 'response') {
      sendData('live_event', parseResponse(dataObject), appletId);
      return ;
    }

    if (tryIndex < config.maxRetryCount && result.nativeEvent.correctAnswers < 75) {
      setResponses(responses.concat(dataObject));
      setTryIndex(tryIndex+1);
      NativeModules.FlankerViewManager.parameterGame(true, 5, tryIndex+1);

      setCount(count + 1);
    } else {
      onChange(responses.concat(dataObject).map(record => parseResponse(record)), true);
    }
    };

  // Prepare config data for injecting into the WebView
  const trials = config.trials.map(trial => ({
    stimulus: {
      en: trial.image
    },
    choices: trial.valueConstraints.itemList,
    correctChoice: typeof trial.value === 'undefined' ? -1 : trial.value,
    weight: typeof trial.weight === 'undefined' ? 1 : trial.weight,
  }));

  const continueText = [
    `Press the button below to ${config.lastScreen ? 'finish' : 'continue'}.`
  ];
  const restartText = [
    'Remember to respond only to the central arrow.',
    'Press the button below to end current block and restart.'
  ];

  const configObj = {
    trials,
    showFixation: config.showFixation !== false,
    showFeedback: config.showFeedback !== false,
    showResults: config.showResults !== false,
    trialDuration: config.trialDuration || 1500,
    samplingMethod: config.samplingMethod,
    samplingSize: config.sampleSize,
    buttonLabel: config.nextButton || 'Finish',
    minimumAccuracy: tryIndex < config.maxRetryCount && config.minimumAccuracy || 0,
    continueText,
    restartText: tryIndex+1 < config.maxRetryCount ? restartText : continueText
  };
  const screenCountPerTrial = configObj.showFeedback ? 3 : 2;

  const injectConfig = `
    window.CONFIG = ${JSON.stringify(configObj)};
    start();
  `;

  const source = Platform.select({
    ios: htmlSource,
    android: { uri: 'file:///android_asset/html/visual-stimulus-response.html' },
  });

  useEffect(() => {
    if (isCurrent) {
      if(Platform.OS === 'ios') {
        NativeModules.FlankerViewManager.parameterGame(true, 5, tryIndex);
      } else {
        webView.current.injectJavaScript(injectConfig);
      }
    }
  }, [isCurrent])

  const parseResponse = (record) => ({
    trial_index: Math.ceil((record.trial_index + 1) / screenCountPerTrial),
    duration: record.rt,
    question: record.stimulus,
    button_pressed: record.button_pressed,
    start_time: record.image_time,
    correct: record.correct,
    start_timestamp: record.start_timestamp,
    offset: record.start_timestamp - record.start_time,
    tag: record.tag,
  })

  if(Platform.OS === 'ios') {
    return (
      <View
        style={{
          height: '100%',
          position: 'relative',
        }}
      >
      <View
        style={{
            backgroundColor: 'white',
            width: '100%',
            height: '100%',
            flex: 1,
            osition: 'absolute',
            alignItems: 'center',
            justifyContent: 'center'
        }}
      >
      <FlankerView 
        style={{ 
            backgroundColor: 'white',
            width: '100%',
            height: '100%',
            flex: 1,
            position: 'absolute',
            alignItems: 'center',
            justifyContent: 'center' }} 
            onEndGame={onEndGame}
      />
      </View>  
      </View>
    );
  } else {
      return (
        <View
          style={{
            height: '100%',
            position: 'relative'
          }}
        >
          <WebView
            ref={(ref) => webView.current = ref}
            style={{ flex: 1, height: '100%' }}
            onLoad={() => setLoading(false)}
            source={source}
            originWhitelist={['*']}
            scrollEnabled={false}
            onMessage={(e) => {
              const dataString = e.nativeEvent.data;
              const { type, data } = JSON.parse(dataString);

              if (type == 'response') {
                sendData('live_event', parseResponse(data), appletId);
                return ;
              }

              let correctCount = 0, totalCount = 0;
              for (let i = 0; i < data.length; i++) {
                if (data[i].tag == 'trial') {
                  totalCount++;
                  if (data[i].correct) {
                    correctCount++;
                  }
                }
              }

              if (
                config.minimumAccuracy &&
                correctCount * 100 / config.minimumAccuracy < totalCount && 
                tryIndex < config.maxRetryCount
              ) {
                setResponses(responses.concat(data.filter(trial => trial.tag != 'result' && trial.tag != 'prepare')));
                webView.current.injectJavaScript(injectConfig);
                setTryIndex(tryIndex+1);
              } else {
                setLoading(true);

                setTimeout(() => {
                  onChange(responses.concat(data.filter(trial => trial.tag != 'result' && trial.tag != 'prepare')).map(record => parseResponse(record)), true);
                }, 0)
              }
            }}
          />

          {
            loading && (
              <View
                style={{
                  backgroundColor: 'white',
                  width: '100%',
                  height: '100%',
                  flex: 1,
                  position: 'absolute',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <ActivityIndicator size="large" />
              </View>
            ) || <></>
          }
        </View>
      );
    }
};

VisualStimulusResponse.propTypes = {
  config: PropTypes.shape({
    trials: PropTypes.arrayOf(PropTypes.shape({
      image: PropTypes.string,
      valueConstraints: PropTypes.object,
      value: PropTypes.number,
      weight: PropTypes.number,
    })),
    showFixation: PropTypes.bool,
    showFeedback: PropTypes.bool,
    showResults: PropTypes.bool,
    trialDuration: PropTypes.number,
    samplingMethod: PropTypes.string,
    samplingSize: PropTypes.number,
  }).isRequired,
  onChange: PropTypes.func.isRequired,
  isCurrent: PropTypes.bool.isRequired,
  appletId: PropTypes.string.isRequired,
};
