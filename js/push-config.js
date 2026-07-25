// Bildirimler (Push Notifications) için Firebase Cloud Messaging VAPID
// anahtarı. Firebase Console > Project Settings > Cloud Messaging >
// "Web configuration" > "Generate key pair" ile alınır. Bu anahtarın
// görünmesi güvenlik riski oluşturmaz, herkese açık kullanım için tasarlanmış.

const pushConfig = {
  vapidKey: "BURAYA_VAPID_KEY"
};
