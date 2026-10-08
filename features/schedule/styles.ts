import React from 'react';
import { StyleSheet } from 'react-native';

import Colors from '@/constants/Colors';

export const styles = StyleSheet.create({
  temporaryOverlay: { flex: 1, justifyContent: 'center', padding: 24 },
  temporaryDialog: { padding: 24, borderRadius: 20, backgroundColor: Colors.brand.primary, maxHeight: '90%' },
  container: { flex: 1, backgroundColor: Colors.brand.primary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    height: 52, paddingHorizontal: 20,
  },
  backButton: { width: 36, height: 36 },
  backCircle: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.white, marginRight: 1 },
  headerTitle: { fontFamily: 'SUIT-Bold', fontSize: 18, color: Colors.brand.white },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 20 },
  label: {
    fontFamily: 'SUIT-SemiBold', fontSize: 14, color: Colors.brand.white,
    marginTop: 20, marginBottom: 8,
  },
  input: {
    fontFamily: 'SUIT-Regular', fontSize: 16, color: Colors.brand.white,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  dateInputRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  calendarIcon: { fontSize: 18 },
  pickerButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  pickerText: { fontFamily: 'SUIT-Regular', fontSize: 16, color: Colors.brand.white },
  pickerPlaceholder: { color: 'rgba(255,255,255,0.25)' },
  pickerArrow: { fontSize: 10, color: 'rgba(255,255,255,0.4)' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timePickerButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  timeLabel: { fontFamily: 'SUIT-Regular', fontSize: 16, color: 'rgba(255,255,255,0.6)' },
  visibilityRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  visibilityText: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: Colors.brand.white },
  visibilityDesc: {
    fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.35)',
    marginTop: 6, paddingHorizontal: 4,
  },

  // Participant step
  promptText: {
    fontFamily: 'SUIT-SemiBold', fontSize: 16, color: Colors.brand.white,
    marginBottom: 16,
  },
  tabRow: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10, marginBottom: 14,
  },
  tabItem: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabItemActive: { backgroundColor: 'rgba(255,255,255,0.15)' },
  tabText: { fontFamily: 'SUIT-SemiBold', fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  tabTextActive: { color: Colors.brand.white },
  searchLoading: { paddingVertical: 12, alignItems: 'center' },
  searchResults: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    marginTop: 8, overflow: 'hidden',
  },
  searchItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  searchNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  participantInfo: { flex: 1, minWidth: 0 },
  searchName: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: Colors.brand.white, flexShrink: 1 },
  searchSub: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  emptyText: {
    fontFamily: 'SUIT-Regular', fontSize: 14, color: 'rgba(255,255,255,0.3)',
    textAlign: 'center', paddingVertical: 16,
  },

  // Selected user
  selectedCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: 'rgba(52,199,89,0.3)',
  },

  // Added participants
  addedSection: {
    padding: 16, borderRadius: 16, marginBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  newParticipantSection: {
    padding: 16, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(0,180,216,0.65)',
  },
  participantSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  participantSectionTitle: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.white, flexShrink: 1 },
  participantSectionHint: { fontFamily: 'SUIT-Regular', fontSize: 13, lineHeight: 20, color: 'rgba(255,255,255,0.65)', marginBottom: 12 },
  participantCountBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.12)' },
  participantCountText: { fontFamily: 'SUIT-SemiBold', fontSize: 13, color: Colors.brand.white },
  newParticipantMark: { fontSize: 22, color: Colors.brand.accent },
  addedCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 6,
  },
  addedNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addedName: { fontFamily: 'SUIT-SemiBold', fontSize: 14, color: Colors.brand.white, flexShrink: 1 },
  addedCategory: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  addedRemove: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  addedRemoveText: { fontSize: 14, color: 'rgba(255,255,255,0.5)' },
  addedDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 8, marginBottom: 8 },

  // License section
  licenseSection: { marginTop: 4 },
  licenseItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 6,
  },
  licenseItemSelected: {
    backgroundColor: 'rgba(52,199,89,0.08)',
    borderWidth: 1, borderColor: 'rgba(52,199,89,0.2)',
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.brand.success, borderColor: Colors.brand.success,
  },
  checkboxNew: {
    backgroundColor: Colors.brand.warning, borderColor: Colors.brand.warning,
  },
  checkmark: { fontFamily: 'SUIT-Bold', fontSize: 13, color: Colors.brand.white },
  licenseName: { fontFamily: 'SUIT-SemiBold', fontSize: 14, color: Colors.brand.white },
  licenseAssoc: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 1 },
  licenseNew: { fontFamily: 'SUIT-Regular', fontSize: 12, color: Colors.brand.warning, marginTop: 1 },
  addLicenseButton: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center', marginTop: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderStyle: 'dashed',
  },
  addLicenseText: {
    fontFamily: 'SUIT-SemiBold', fontSize: 13, color: 'rgba(255,255,255,0.5)',
  },

  // Bottom
  bottomArea: { paddingHorizontal: 24, paddingVertical: 12 },
  bottomRow: { flexDirection: 'row', gap: 10 },
  primaryButton: {
    height: 54, borderRadius: 14, backgroundColor: Colors.brand.white,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryButtonText: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.primary },
  secondaryButton: {
    height: 54, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20,
  },
  secondaryButtonText: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.white },
});
