import { AppRegistry } from 'react-native';
import { registerRootComponent } from 'expo';
import RNAndroidNotificationListener, { RNAndroidNotificationListenerHeadlessJsName } from 'react-native-android-notification-listener';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from './App';

const headlessNotificationListener = async ({ notification }) => {
    if (notification) {
        try {
            const parsed = JSON.parse(notification);

            // Skip our own foreground service notification
            if (parsed.app === 'com.rakesh.laptop' || parsed.title === 'Laptop Access Active') {
                return;
            }

            // Get the API base URL
            const apiBase = await AsyncStorage.getItem('apiBase') || "http://100.67.104.120:62007/api/system";
            const host = apiBase.replace('/api/system', '');

            const payload = JSON.stringify({
                title: parsed.title || "Notification",
                body: parsed.text || "You have a new notification",
                app_name: parsed.app || "Android App"
            });

            // Try to send with retry logic
            let success = false;
            for (let attempt = 0; attempt < 3 && !success; attempt++) {
                try {
                    const response = await Promise.race([
                        fetch(host + "/api/notifications/send_to_desktop", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: payload
                        }),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
                    ]);
                    if (response.ok) {
                        success = true;
                    }
                } catch (fetchErr) {
                    console.log(`[Notification] Attempt ${attempt + 1} failed:`, fetchErr.message);
                    if (attempt < 2) {
                        await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); // backoff
                    }
                }
            }

            if (!success) {
                console.log('[Notification] Failed to forward after 3 attempts:', parsed.title);
            }

        } catch (e) {
            console.log('[Notification] Parse/send error:', e);
        }
    }
};

AppRegistry.registerHeadlessTask(RNAndroidNotificationListenerHeadlessJsName, () => headlessNotificationListener);
registerRootComponent(App);
