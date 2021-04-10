import React from 'react';
import PropTypes from 'prop-types';
import { View, ScrollView,KeyboardAvoidingView, TextInput, Platform } from 'react-native';
import {Item , Input } from 'native-base';
import TimePicker from './TimePicker';
import i18n from 'i18next';

const defaultTime = { hour: 0, minute: 0 };

export class TimeRange extends React.Component {

  finalAnswer = {};

  handleComment = (itemValue) => {
    const {onChange} = this.props;
    this.finalAnswer["text"] = itemValue;
    onChange(this.finalAnswer);
  }


  onChangeFrom = (newFromVal) => {
    const { onChange} = this.props;


    this.finalAnswer["value"] = {
      from: newFromVal,
      to: this.finalAnswer["value"] ? this.finalAnswer["value"].to : defaultTime,
    };

    onChange(this.finalAnswer);

  }

  onChangeTo = (newToVal) => {
    const { onChange } = this.props;

    this.finalAnswer["value"] = {
      from: this.finalAnswer["value"] ? this.finalAnswer["value"].from : defaultTime,
      to: newToVal,
    };
    onChange(this.finalAnswer);

  }

  render() {
    const { value ,isOptionalText, isOptionalTextRequired } = this.props;

    this.finalAnswer = value ? value : {};

    const safeValue = this.finalAnswer["value"] || {
      from: defaultTime,
      to: defaultTime,
    };

    this.finalAnswer["value"] = safeValue ? safeValue :[];

    return (
      <KeyboardAvoidingView>
      <View style={{ alignItems: 'stretch' }}>
        <TimePicker value={this.finalAnswer["value"].from} onChange={this.onChangeFrom} label="From" />
        <TimePicker value={this.finalAnswer["value"].to} onChange={this.onChangeTo} label="To" />
        {isOptionalText ?
          (<View style={{
            marginTop: '8%' ,
            width: '100%' ,
          }}
          >
        <Item bordered
          style={{borderWidth: 1}}
        >
          <TextInput
              style={{
                width: '100%',
                ... Platform.OS !== 'ios' ? {} : { maxHeight: 100 }
              }}
              placeholder = {
                i18n.t(isOptionalTextRequired ? 'optional_text:required' : 'optional_text:enter_text')
              }
              onChangeText={text=>this.handleComment(text)}
              value={this.finalAnswer["text"]}
              multiline={true}
          />
        </Item>
    </View>
    ):<View></View>
      }

      </View>
      </KeyboardAvoidingView>
    );
  }
}

TimeRange.defaultProps = {
  value: undefined,
};

TimeRange.propTypes = {
  value: PropTypes.shape({
    from: PropTypes.object,
    to: PropTypes.object,
  }),
  onChange: PropTypes.func.isRequired,
};
