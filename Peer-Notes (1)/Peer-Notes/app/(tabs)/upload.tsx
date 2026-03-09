import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ScrollView, useColorScheme, ActivityIndicator,
  Platform, Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import * as DocumentPicker from 'expo-document-picker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Subject } from '../../shared/schema';
import { getApiUrl } from '@/lib/query-client';
import { File } from 'expo-file-system';
import { fetch } from 'expo/fetch';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function UploadScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const C = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const qc = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [semester, setSemester] = useState(1);
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const { data: subjects = [] } = useQuery<Subject[]>({ queryKey: ['/api/subjects'] });

  const webTopPadding = Platform.OS === 'web' ? 67 : 0;
  const webBottomPadding = Platform.OS === 'web' ? 34 : 0;

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/*'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets[0]) {
        setFile(result.assets[0]);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not pick file');
    }
  };

  const handleUpload = async () => {
    if (!title.trim()) return Alert.alert('Error', 'Please enter a title');
    if (!subjectId) return Alert.alert('Error', 'Please select a subject');
    if (!file) return Alert.alert('Error', 'Please select a file');

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('subject_id', subjectId);
      formData.append('semester', String(semester));

      const fileObj = new File(file.uri);
      formData.append('file', fileObj, file.name || 'upload');

      const url = new URL('/api/notes', getApiUrl());
      const res = await fetch(url.toString(), {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Upload failed');
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccess(true);
      qc.invalidateQueries({ queryKey: ['/api/notes'] });

      setTimeout(() => {
        setTitle('');
        setDescription('');
        setSubjectId('');
        setSemester(1);
        setFile(null);
        setSuccess(false);
        router.push('/(tabs)');
      }, 2000);
    } catch (e: any) {
      Alert.alert('Upload Failed', e.message?.replace(/^\d+: /, '') || 'Something went wrong');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <View style={[styles.container, { backgroundColor: C.background, alignItems: 'center', justifyContent: 'center' }]}>
        <View style={[styles.successCard, { backgroundColor: C.card }]}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={64} color="#10B981" />
          </View>
          <Text style={[styles.successTitle, { color: C.text }]}>Upload Submitted!</Text>
          <Text style={[styles.successSubtitle, { color: C.textSecondary }]}>
            Your notes are pending admin approval. They'll be visible once approved.
          </Text>
        </View>
      </View>
    );
  }

  const fileExt = file?.name?.split('.').pop()?.toLowerCase();
  const fileColor = fileExt === 'pdf' ? '#EF4444' : fileExt === 'doc' || fileExt === 'docx' ? '#3B82F6' : '#10B981';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: C.background }]}
      contentContainerStyle={[styles.content, {
        paddingTop: insets.top + webTopPadding + 16,
        paddingBottom: insets.bottom + webBottomPadding + 90,
      }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.title, { color: C.text }]}>Upload Notes</Text>
      <Text style={[styles.subtitle, { color: C.textSecondary }]}>
        Share your knowledge with the community
      </Text>

      <Animated.View entering={FadeInDown.delay(100).springify()} style={[styles.card, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: C.textSecondary }]}>Title *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: C.inputBg, color: C.text, borderColor: C.border }]}
            placeholder="e.g. Calculus Complete Notes - Sem 2"
            placeholderTextColor={C.textTertiary}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: C.textSecondary }]}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: C.inputBg, color: C.text, borderColor: C.border }]}
            placeholder="What topics are covered? Who is this for?"
            placeholderTextColor={C.textTertiary}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: C.textSecondary }]}>Subject *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.subjectGrid}>
              {subjects.map(sub => (
                <Pressable
                  key={sub.id}
                  style={[
                    styles.subjectChip,
                    { borderColor: sub.color + '44', backgroundColor: C.inputBg },
                    subjectId === sub.id && { backgroundColor: sub.color, borderColor: sub.color },
                  ]}
                  onPress={() => setSubjectId(sub.id)}
                >
                  <Text style={[
                    styles.subjectChipText,
                    { color: subjectId === sub.id ? '#fff' : sub.color }
                  ]}>
                    {sub.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: C.textSecondary }]}>Semester *</Text>
          <View style={styles.semGrid}>
            {SEMESTERS.map(s => (
              <Pressable
                key={s}
                style={[
                  styles.semChip,
                  { backgroundColor: C.inputBg, borderColor: C.border },
                  semester === s && { backgroundColor: '#0EA5E9', borderColor: '#0EA5E9' },
                ]}
                onPress={() => setSemester(s)}
              >
                <Text style={[styles.semChipText, semester === s && { color: '#fff' }]}>
                  {s}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).springify()}>
        <Pressable
          style={[styles.filePicker, { borderColor: file ? fileColor + '66' : C.border, backgroundColor: file ? fileColor + '11' : C.card }]}
          onPress={pickFile}
        >
          {file ? (
            <View style={styles.fileInfo}>
              <Ionicons name="document-text" size={32} color={fileColor} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.fileName, { color: C.text }]} numberOfLines={1}>{file.name}</Text>
                <Text style={[styles.fileSize, { color: C.textSecondary }]}>
                  {file.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Size unknown'}
                </Text>
              </View>
              <Pressable onPress={() => setFile(null)}>
                <Ionicons name="close-circle" size={22} color={C.textSecondary} />
              </Pressable>
            </View>
          ) : (
            <View style={styles.filePickerContent}>
              <View style={[styles.fileIconWrapper, { backgroundColor: '#0EA5E922' }]}>
                <Ionicons name="cloud-upload-outline" size={32} color="#0EA5E9" />
              </View>
              <Text style={[styles.filePickerTitle, { color: C.text }]}>Select a file</Text>
              <Text style={[styles.filePickerSub, { color: C.textSecondary }]}>PDF, DOC, DOCX, or Images • Max 50MB</Text>
            </View>
          )}
        </Pressable>
      </Animated.View>

      <Pressable
        style={({ pressed }) => [
          styles.uploadBtn,
          pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
          loading && { opacity: 0.7 }
        ]}
        onPress={handleUpload}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <>
            <Ionicons name="cloud-upload" size={20} color="#fff" />
            <Text style={styles.uploadBtnText}>Submit for Review</Text>
          </>
        }
      </Pressable>

      <View style={styles.note}>
        <Ionicons name="information-circle-outline" size={14} color="#64748B" />
        <Text style={[styles.noteText, { color: C.textSecondary }]}>
          Your notes will be reviewed by an admin before being published to the community.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 16 },
  title: { fontSize: 26, fontFamily: 'Nunito_800ExtraBold', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, fontFamily: 'Nunito_400Regular', marginTop: -8 },
  card: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    gap: 20,
  },
  fieldGroup: { gap: 8 },
  label: { fontSize: 13, fontFamily: 'Nunito_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Nunito_500Medium',
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  subjectGrid: { flexDirection: 'row', gap: 8 },
  subjectChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  subjectChipText: { fontSize: 13, fontFamily: 'Nunito_600SemiBold' },
  semGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  semChip: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  semChipText: { fontSize: 14, fontFamily: 'Nunito_600SemiBold', color: '#64748B' },
  filePicker: {
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
    padding: 24,
  },
  filePickerContent: { alignItems: 'center', gap: 10 },
  fileIconWrapper: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  filePickerTitle: { fontSize: 16, fontFamily: 'Nunito_700Bold' },
  filePickerSub: { fontSize: 13, fontFamily: 'Nunito_400Regular', textAlign: 'center' },
  fileInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fileName: { fontSize: 15, fontFamily: 'Nunito_600SemiBold' },
  fileSize: { fontSize: 12, fontFamily: 'Nunito_400Regular', marginTop: 2 },
  uploadBtn: {
    backgroundColor: '#0EA5E9',
    borderRadius: 16,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  uploadBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Nunito_700Bold' },
  note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingHorizontal: 4 },
  noteText: { fontSize: 13, fontFamily: 'Nunito_400Regular', flex: 1, lineHeight: 19 },
  successCard: {
    borderRadius: 24,
    padding: 40,
    alignItems: 'center',
    gap: 16,
    marginHorizontal: 24,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#10B98122',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: { fontSize: 22, fontFamily: 'Nunito_800ExtraBold' },
  successSubtitle: { fontSize: 15, fontFamily: 'Nunito_400Regular', textAlign: 'center', lineHeight: 22 },
});
