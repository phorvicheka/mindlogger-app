import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { View, Platform, TouchableOpacity, StyleSheet, Image, KeyboardAvoidingView, ScrollView, TextInput } from "react-native";
import NativeGeolocation from "@react-native-community/geolocation";
import { Icon , Item , Input} from "native-base";
import Permissions, { PERMISSIONS } from "react-native-permissions";
import { colors } from "../theme";
import BaseText from "../components/base_text/base_text";
import { getURL } from '../services/helper';
import i18n from 'i18next';

const styles = StyleSheet.create({
  locationButton: {
    borderRadius: 3,
    backgroundColor: colors.primary,
    padding: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 1,
  },
  buttonText: {
    fontWeight: "bold",
    color: "white",
    fontSize: 18,
    marginLeft: 5,
    marginRight: 5,
  },
  container: {
    alignItems: "flex-start",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center"
  },
  imgContainer: {
    padding: 20,
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center"

  },
  img: {
    width: 300,
    height: 300,


  },
  infoText: {
    color: colors.tertiary,
    fontSize: 16,
    marginTop: 16,
  },

});

export const Geolocation = ({ config,value, onChange ,isOptionalText, isOptionalTextRequired}) => {
  const [locationPermission, setLocationPermission] = useState("undetermined");
  const permission = Platform.select({
    android: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
    ios: PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
  });



  let finalAnswer= value ? value :{};


  handleComment = (itemValue) => {

    finalAnswer["text"] = itemValue;

    onChange(finalAnswer);
  }

  useEffect(() => {
    Permissions.check(permission).then(setLocationPermission);
  });

  const onPress = () => {
    Permissions.request(permission).then((response) => {
      // console.log(response);
      setLocationPermission(response);
      if (response === Permissions.RESULTS.GRANTED) {
        NativeGeolocation.getCurrentPosition(
          (successResponse) => {
            finalAnswer["value"] = {
              latitude: successResponse.coords.latitude,
              longitude: successResponse.coords.longitude,
            } ;

            onChange(finalAnswer);
          },
          (errorResponse) => {
            console.warn(errorResponse);
          }
        );
      }
    });
  };

  return (
    <KeyboardAvoidingView
   // behavior="padding"
  >
    <View style={styles.container}>
      <TouchableOpacity onPress={onPress}>
        <View style={styles.locationButton}>
          <BaseText
            style={styles.buttonText}
            textKey="geolocation:get_location"
          />
          <Icon
            style={styles.buttonText}
            type="FontAwesome"
            name="map-marker"
          />
        </View>
      </TouchableOpacity>

      {locationPermission === "denied" && Platform.OS === "ios" && (
        <View>
          <BaseText
            style={styles.infoText}
            textKey="geolocation:must_enable_location"
          />
        </View>
      )}
      {locationPermission === "denied" && Platform.OS === "android" && (
        <View>
          <BaseText
            style={styles.infoText}
            textKey="geolocation:must_enable_location_subtitle"
          />
        </View>
      )}
      {locationPermission !== "denied" &&
        typeof finalAnswer["value"]?.latitude !== "undefined" && (
          <View>
            <BaseText
              style={styles.infoText}
              textKey="geolocation:location_saved"
            />
          </View>
        )}


      {config?.image ? (
        <View style = {styles.imgContainer}>
        <Image
         style = {styles.img}
        source={{
          uri: config.image,
        }}
      />
       </View> ) :<View></View>
       }


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
              minHeight: 50,
              ... Platform.OS !== 'ios' ? {} : { maxHeight: 100, minHeight: 40 }
            }}
            placeholder = {
              i18n.t(isOptionalTextRequired ? 'optional_text:required' : 'optional_text:enter_text')
            }
            onChangeText={text=>handleComment(text)}
            value={finalAnswer["text"]}
            multiline={true}
        />
      </Item>
    </View>
    ):<View></View>
      }

    </View>
    </KeyboardAvoidingView>
  );
};

Geolocation.defaultProps = {
  value: {},
  onChange: () => {},
 // isOptionalText,
};

Geolocation.propTypes = {
  config: PropTypes.object,
  value: PropTypes.object,
  onChange: PropTypes.func,
  isOptionalText: PropTypes.bool,
  isOptionalTextRequired: PropTypes.bool
};
