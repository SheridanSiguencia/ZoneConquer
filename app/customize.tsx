// app/customize.tsx
import { Ionicons } from "@expo/vector-icons";
import { router } from 'expo-router';
import { useState } from "react";
import{
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

export default function CustomizeScreen() {
    const [name,setName] = useState( 'Alex Rider');
    const [handle, setHandle] = useState('@alex');

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style = {styles.backButton}>
                    <Ionicons name = "arrow-back" size={24} color="#111827"/>
                </Pressable>
                <Text style = {styles.title}>Customize Profile</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Profile Picture</Text>
                <View style={styles.avatarContainer}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>A</Text>
                    </View>
                    <Pressable style={styles.changeAvatarButton}>
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
               />
             </View>
             <View style={styles.inputContainer}>
               <Text style={styles.label}>Handle</Text>
               <TextInput
                 style={styles.input}
                 value={handle}
                 onChangeText={setHandle}
               />
             </View>
           </View>

            <Pressable
            style={[styles.actionBtn, styles.primary]}
            onPress={() => router.back()}
            >
                <Text style={styles.actionTextPrimary}>Save</Text>
            </Pressable>
        </ScrollView>
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
        backgroundColor: 'white',
        borderRadius: 9999,
        padding: 8,
    },
    title: {
        fontSize: 24,
        fontWeight: '900', 
        color: '#111827',  
    },
    section: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 14,
        gap: 12,
    },
    sectionTitle: {
        fontSize: 16, 
        fontWeight: '900',
        color: '#111827',
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
        backgroundColor: "#e6ffef",
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        color: '#22c55e',
        fontSize: 32,
        fontWeight: '900',
    },
    changeAvatarButton: {
        backgroundColor: '#e5e7eb',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 999,
    },
    changeAvatarText: {
        fontWeight: '800',
        color: '#111827', 
    },
    inputContainer: {
        gap: 4,
    },
    label: {
        fontWeight: '600',
        color: '#374151',
    },
    input: {
        backgroundColor: '#f3f4f6',
        borderRadius: 8, 
        paddingHorizontal: 12, 
        paddingVertical: 10,
        fontSize: 16,
        color: '#111827',
    },
    actionBtn: {
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row', 
        gap: 8,
    }, 
    primary: {
        backgroundColor: '#22c55e',
    },
    actionTextPrimary: {
        color: 'white',
        fontWeight: '800',
    },

});