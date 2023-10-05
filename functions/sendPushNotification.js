// eslint-disable-next-line
const { getMessaging } = require('firebase-admin/messaging');
const firebaseAdmin = require('../firebase/firebase');

const db = firebaseAdmin.firestore();

async function getFCMTokens(registration) {
  // First we need the users registered to this truck
  const usersRef = db.collection('users');
  const usersSnapshot = await usersRef.where('devices', 'array-contains', registration).get();

  if (usersSnapshot.empty) {
    console.log('No users registered to this truck.');
    return [];
  }

  // Collect promises for FCM token retrieval
  const promises = usersSnapshot.docs.map(async (doc) => {
    const fcmRef = db.collection('users').doc(doc.id).collection('fcm_tokens');
    const fcmSnapshot = await fcmRef.get();

    if (fcmSnapshot.empty) {
      console.log('This user does not have any FCM tokens');
      return [];
    }

    return fcmSnapshot.docs.map((fcmDoc) => fcmDoc.data().fcm_token);
  });

  // Wait for all promises to finish and flatten results into a single array
  const results = await Promise.all(promises);
  return [].concat(...results);
}

async function sendPushNotification(registration, notificationTitle, notificationMessage) {
  try {
    // Get the necessary FCM tokens
    const fcmTokensList = await getFCMTokens(registration);

    const promises = fcmTokensList.map(async (registrationToken) => {
      const message = {
        notification: {
          title: notificationTitle,
          body: notificationMessage,
        },
        apns: {
          headers: {
            'apns-priority': '10',
          },
          payload: {
            aps: {
              sound: 'default',
            },
          },
        },
        android: {
          notification: {
            sound: 'default',
          },
        },
        token: registrationToken,
      };

      try {
        const response = await getMessaging().send(message);
        console.log('Successfully sent message:', response);
      } catch (error) {
        console.log('Error sending message:', error);
      }
    });

    await Promise.all(promises);
  } catch (error) {
    console.log('Error fetching FCM tokens or sending notifications:', error);
  }
}

module.exports = sendPushNotification;
