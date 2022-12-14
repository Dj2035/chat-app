import React from 'react';
import {
  View, StyleSheet, Platform, KeyboardAvoidingView, Clipboard
} from 'react-native';
import { GiftedChat, Bubble, InputToolbar } from 'react-native-gifted-chat';
//import Clipboard from '@react-native-clipboard/clipboard';

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import CustomActions from './CustomActions';
import MapView from 'react-native-maps';

import firebase from 'firebase';
import 'firebase/firestore';
//const firebase = require('firebase');
//require('firebase/firestore');


export default class Chat extends React.Component {
  constructor() {
    super();
    this.state = {
      messages: [],
      uid: 0,
      isConnected: false,
      user: {
        _id: '',
        name: '',
        avatar: '',
      },
      image: null,
      location: null,
    }

    //Firestore database credentials
    const firebaseConfig = {
      apiKey: "AIzaSyBlc3lbpOaomK1bZye9z0jyl5cD_0j1Eqo",
      authDomain: "chatapp-9678f.firebaseapp.com",
      projectId: "chatapp-9678f",
      storageBucket: "chatapp-9678f.appspot.com",
      messagingSenderId: "534861036277",
      appId: "1:534861036277:web:e3bdbe5830d0d1d619e3bc"
    };

    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }

    // creating a reference to the messages collection on firebase
    this.referenceChatMessages = firebase.firestore().collection("messages");
  }

  //Retrieve collection data & store in messages
  onCollectionUpdate = (querySnapshot) => {
    const messages = [];
    // Go through each document
    querySnapshot.forEach((doc) => {
      // Get QueryDocumentSnapshot's data
      let data = doc.data();
      messages.push({
        _id: data._id,
        text: data.text,
        createdAt: data.createdAt.toDate(),
        user: {
          _id: data.user._id,
          name: data.user.name,
          avatar: data.user.avatar,
        },
        image: data.image || null,
        location: data.location || null,
      });
    });
    this.setState({
      messages,
    });
  };

  // Fetches messages from asyncStorage (local)
  async getMessages() {
    let messages = '';
    try {
      messages = await AsyncStorage.getItem('messages') || [];
      this.setState({
        messages: JSON.parse(messages)
      });
    } catch (error) {
      console.log(error.message);
    }
  };

  // Saves messages in asyncStorage (local)
  async saveMessages() {
    try {
      await AsyncStorage.setItem('messages', JSON.stringify(this.state.messages));
      console.log(this.state.messages);
    } catch (error) {
      console.log(error.message);
    }
  }

  //To delete stored messages
  async deleteMessages() {
    try {
      await AsyncStorage.removeItem('messages');
      this.setState({
        messages: []
      })
    } catch (error) {
      console.log(error.message);
    }
  }

  // Hide InputToolbar when user if online!
  renderInputToolbar(props) {
    if (this.state.isConnected == false) {
    } else {
      return (
        <InputToolbar
          {...props}
        />
      );
    }
  }

  componentDidMount() {
    //Display username in navigation
    let { name } = this.props.route.params;
    this.props.navigation.setOptions({ title: name });

    // Check (anonymous) user authentication through firebase
    this.authUnsubscribe = firebase.auth().onAuthStateChanged((user) => {
      if (!user) {
        firebase.auth().signInAnonymously();
      }

      //update user state with currently active user data
      this.setState({
        uid: user.uid,
        user: {
          _id: user.uid,
          name: name,
          avatar: "https://placeimg.com/140/140/any",
        },
      });
    });

    NetInfo.fetch().then(connection => {
      if (connection.isConnected) {
        this.setState({ isConnected: true });
        console.log('online');

        // Get messages from firestore
        this.referenceChatMessages = firebase.firestore().collection('messages');

        // listening to messages collection changes
        this.unsubscribe = this.referenceChatMessages
          .orderBy("createdAt", "desc")
          .onSnapshot(this.onCollectionUpdate);

        this.saveMessages();
      } else {
        this.setState({ isConnected: false });
        // Load messages from asyncStorage when offline
        this.getMessages();
        // Add offline message
        this.props.navigation.setOptions({ title: `${name} (offline)` }); s
        console.log('offline');
      }

    });
  }

  componentWillUnmount() {
    // stop listening for changes
    this.unsubscribe();
    // stop listening to authentication
    this.authUnsubscribe();
  }

  // add a new message to the database collection
  addMessages = () => {
    const message = this.state.messages[0];
    this.referenceChatMessages.add({
      uid: this.state.uid,
      _id: message._id,
      text: message.text || '',
      createdAt: message.createdAt,
      user: message.user,
      image: message.image || null,
      location: message.location || null,
    });
  }

  // Create custom onSend function, appending the newly created message to the messages state, 
  // then calling addMessage to add to Firestore
  onSend(messages = []) {
    this.setState(previousState => ({
      messages: GiftedChat.append(previousState.messages, messages),
    }), () => {
      this.addMessages(messages[0]);
      this.saveMessages();
    });
  }

  // The renderBubble prop allows you to alter how message bubbles are displayed
  renderBubble(props) {
    return (
      <Bubble
        {...props}
        wrapperStyle={styles.bubble}
      />
    )
  }

  renderCustomActions = (props) => {
    return <CustomActions {...props} />;
  };

  renderCustomView(props) {
    const { currentMessage } = props;
    if (currentMessage.location) {
      return (
        <MapView
          style={{
            width: 150,
            height: 100,
            borderRadius: 13,
            margin: 3
          }}
          region={{
            latitude: currentMessage.location.latitude,
            longitude: currentMessage.location.longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          }}
        />
      );
    }
    return null;
  }

  //code to delete a message
  onDelete = async (messageId) => {
    this.setState(previousState =>
      ({ messages: previousState.messages.filter(message => message._id !== messageId) }))

    this.referenceChatMessages.doc(messages._id).delete();

  }

  // Action sheet for long press on a message
  handleLongPress = (context, message) => {
    console.log("long press function");
    const options = ["Copy", "Delete Message", "Cancel"];
    const cancelButtonIndex = options.length - 1;
    context.actionSheet().showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex,
      },
      (buttonIndex) => {
        switch (buttonIndex) {
          case 0:
            Clipboard.setString(message.text);
            return;
          case 1:
            console.log(message);
            context.onDelete(message._id);
        }
      }
    );
  }

  render() {
    let { color, name } = this.props.route.params;

    return (
      <View style={[styles.container, { backgroundColor: color }]} >
        <GiftedChat
          messages={this.state.messages}
          onSend={messages => this.onSend(messages)}
          renderCustomView={this.renderCustomView}
          renderActions={this.renderCustomActions}
          renderInputToolbar={this.renderInputToolbar.bind(this)}
          renderBubble={this.renderBubble.bind(this)}
          alwaysShowSend
          showAvatarForEveryMessage={true}
          onLongPress={messages => this.handleLongPress(this, messages)}
          user={{
            _id: this.state.uid,
            name: name,
            avatar: 'https://placeimg.com/140/140/any',
          }}

        />
        {/* Prevent Keyboard from overlaping text input on older Andriod models */}
        {Platform.OS === 'android' ? <KeyboardAvoidingView behavior="height" /> : null}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bubble: {
    left: {
      backgroundColor: 'white',
    },
    right: {
      backgroundColor: 'blue'
    }
  }
})