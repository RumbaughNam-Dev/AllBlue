import React from 'react';
import { StyleSheet } from 'react-native';

import Colors from '@/constants/Colors';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.primary,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingLeft: 20,
    paddingRight: 8,
    gap: 8,
  },
  segmentScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  segmentItem: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  segmentInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  segmentItemActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  segmentText: {
    fontFamily: 'SUIT-SemiBold',
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
  },
  segmentTextActive: {
    color: Colors.brand.white,
  },
  segmentAddButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentAddText: {
    fontFamily: 'SUIT-Bold',
    fontSize: 18,
    color: 'rgba(255,255,255,0.3)',
  },
  gearButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupSelectHeader: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  groupSelectTitle: {
    fontFamily: 'SUIT-Bold',
    fontSize: 15,
    color: Colors.brand.white,
    textAlign: 'center',
  },
  groupNameInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'SUIT-Regular',
    fontSize: 15,
    color: Colors.brand.white,
    marginBottom: 14,
  },
  listContent: {
    paddingHorizontal: 20,
  },
  friendCard: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  friendInfo: {
    flex: 1,
    minWidth: 0,
  },
  friendNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  friendName: {
    flexShrink: 1,
    lineHeight: 21,
    fontFamily: 'SUIT-SemiBold',
    fontSize: 15,
    color: Colors.brand.white,
  },
  pinIcon: {
    fontSize: 12,
    marginLeft: 8,
  },
  friendMemo: {
    fontFamily: 'SUIT-Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  emptyArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontFamily: 'SUIT-Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    lineHeight: 22,
  },
  bottomButtonArea: {
    position: 'absolute',
    left: 20,
    right: 20,
  },
  addButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    fontFamily: 'SUIT-Bold',
    fontSize: 16,
    color: Colors.brand.white,
  },

  // 컨텍스트 메뉴
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuContainer: {
    width: '70%',
  },
  menuCard: {
    backgroundColor: 'rgba(30,60,100,0.95)',
    borderRadius: 14,
    overflow: 'hidden',
  },
  menuItem: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  menuText: {
    fontFamily: 'SUIT-SemiBold',
    fontSize: 15,
    color: Colors.brand.white,
  },
  menuTextDanger: {
    color: '#FF6B6B',
  },

  // 메모 수정 모달
  memoModalContainer: {
    width: '85%',
  },
  memoModalCard: {
    backgroundColor: 'rgba(30,60,100,0.95)',
    borderRadius: 14,
    padding: 20,
  },
  memoModalTitle: {
    fontFamily: 'SUIT-Bold',
    fontSize: 16,
    color: Colors.brand.white,
    marginBottom: 14,
  },
  memoInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: 14,
    fontFamily: 'SUIT-Regular',
    fontSize: 14,
    color: Colors.brand.white,
    height: 80,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  memoButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  memoCancelButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memoCancelText: {
    fontFamily: 'SUIT-SemiBold',
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },
  memoSaveButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.brand.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memoSaveText: {
    fontFamily: 'SUIT-Bold',
    fontSize: 14,
    color: Colors.brand.primary,
  },

  // 친한친구 등록 검색 모달
  searchModalWrap: {
    flex: 1,
  },
  searchModalContent: {
    maxHeight: '100%',
    flexShrink: 1,
    backgroundColor: Colors.brand.primary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
  },
  searchModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingBottom: 14,
  },
  searchModalTitle: {
    fontFamily: 'SUIT-Bold',
    fontSize: 18,
    color: Colors.brand.white,
  },
  searchInput: {
    fontFamily: 'SUIT-Regular',
    fontSize: 16,
    color: Colors.brand.white,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 12,
  },
  searchResultsScroll: {
    minHeight: 0,
    flexGrow: 0,
    flexShrink: 1,
  },
  searchLoadingArea: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  searchResultInfo: {
    flex: 1,
    minWidth: 0,
  },
  searchResultNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  searchResultName: {
    flexShrink: 1,
    lineHeight: 21,
    fontFamily: 'SUIT-SemiBold',
    fontSize: 15,
    color: Colors.brand.white,
  },
  searchResultSub: {
    fontFamily: 'SUIT-Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  searchNoResult: {
    fontFamily: 'SUIT-Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    paddingTop: 20,
  },
});
