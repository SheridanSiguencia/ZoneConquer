import { Ionicons } from "@expo/vector-icons";
import { router } from 'expo-router';
import { useState, useEffect } from "react";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    ActivityIndicator,
    Alert,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUserStore } from '../store/user';
import Colors from '../constants/Colors';
import { userAPI } from '../services/api';
import * as ImagePicker from 'expo-image-picker';

export default function CustomizeScreen() {
    const { profile, fetchUserProfile } = useUserStore();
    const [name, setName] = useState(profile?.username || '');
    const [email, setEmail] = useState(profile?.email || '');
    const [image, setImage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (profile) {
            setName(profile.username);
            setEmail(profile.email);
        }
    }, [profile]);

    const pickImage = async () => {
        // No permissions request is necessary for launching the image library
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.All,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 1,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    const onSave = async () => {
        setLoading(true);
        try {
            if (image) {
                const formData = new FormData();
                formData.append('profilePicture', {
                    uri: image,
                    name: 'profile.jpg',
                    type: 'image/jpeg',
                } as any);

                const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE}/user/profile-picture`, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                });

                const result = await response.json();
                if (!result.success) {
                    Alert.alert('Error', result.error || 'Failed to upload profile picture.');
                    setLoading(false);
                    return;
                }
            }

            // Call API to update profile
            const result = await userAPI.updateProfile({ username: name, email });
            if (result.success) {
                Alert.alert('Success', 'Profile updated successfully!');
                fetchUserProfile(); // Refresh profile data in store
                router.back();
            } else {
                Alert.alert('Error', result.error || 'Failed to update profile.');
            }
        } catch (e: any) {
            Alert.alert('Error', e.message || 'An unexpected error occurred.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.light.background }}>
            <ScrollView contentContainerStyle={styles.container}>
                <View style={styles.header}>
                    <Pressable onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={Colors.light.secondary} />
                    </Pressable>
                    <Text style={styles.title}>Customize Profile</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Profile Picture</Text>
                    <View style={styles.avatarContainer}>
                        {image ? (
                            <Image source={{ uri: image }} style={styles.avatar} />
                        ) : (
                            <View style={styles.avatar}>
                                <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
                            </View>
                        )}
                        <Pressable style={styles.changeAvatarButton} onPress={pickImage}>
                            <Text style={styles.changeAvatarText}>Change</Text>
                        </Pressable>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Profile Details</Text>
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Name</Text>
                        <TextInput
                            style={styles.input}
                            value={name}
                            onChangeText={setName}
                            placeholderTextColor={Colors.light.gray[400]}
                        />
                    </View>
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Email</Text>
                        <TextInput
                            style={styles.input}
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            placeholderTextColor={Colors.light.gray[400]}
                        />
                    </View>
                </View>

                <Pressable
                    style={[styles.actionBtn, styles.primary, loading && styles.actionBtnDisabled]}
                    onPress={onSave}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color={Colors.dark.text} />
                    ) : (
                        <Text style={styles.actionTextPrimary}>Save</Text>
                    )}
                </Pressable>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { padding: 16, paddingBottom: 32, gap: 16 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    backButton: {
        backgroundColor: Colors.light.background,
        borderRadius: 9999,
        padding: 8,
    },
    title: {
        fontSize: 24,
        fontWeight: '900',
        color: Colors.light.secondary,
        fontFamily: 'SpaceMono',
    },
    section: {
        backgroundColor: Colors.light.background,
        borderRadius: 16,
        padding: 14,
        gap: 12,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: Colors.light.secondary,
        fontFamily: 'SpaceMono',
    },
    avatarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    avatar: {
        height: 80,
        width: 80,
        borderRadius: 9999,
        backgroundColor: Colors.light.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        color: Colors.dark.text,
        fontSize: 32,
        fontWeight: '900',
        fontFamily: 'SpaceMono',
    },
    changeAvatarButton: {
        backgroundColor: Colors.light.gray[200],
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 999,
    },
    changeAvatarText: {
        fontWeight: '800',
        color: Colors.light.secondary,
        fontFamily: 'SpaceMono',
    },
    inputContainer: {
        gap: 4,
    },
    label: {
        fontWeight: '600',
        color: Colors.light.gray[700],
        fontFamily: 'SpaceMono',
    },
    input: {
        backgroundColor: Colors.light.gray[100],
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 16,
        color: Colors.light.secondary,
        fontFamily: 'SpaceMono',
    },
    actionBtn: {
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    actionBtnDisabled: {
        opacity: 0.5,
    },
    primary: {
        backgroundColor: Colors.light.primary,
    },
    actionTextPrimary: {
        color: Colors.dark.text,
        fontWeight: '800',
        fontFamily: 'SpaceMono',
    },
});
