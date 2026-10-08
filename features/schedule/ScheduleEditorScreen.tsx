import ScheduleCategorySelector from '@/components/ScheduleCategorySelector';
import PopupBackdrop from '@/components/PopupBackdrop';
import ProfileLink from '@/components/ProfileLink';
import ProfileAvatar from '@/components/ProfileAvatar';
import React from 'react';
import { View, Modal, Text, TextInput, Pressable, ScrollView, Platform, KeyboardAvoidingView, ActivityIndicator, Keyboard, Switch } from 'react-native';

import { StatusBar } from 'expo-status-bar';
import Colors from '@/constants/Colors';

import BottomSheet from '@/components/BottomSheet';
import DatePickerSheet from '@/components/DatePickerSheet';
import Spinner from '@/components/Spinner';

import { useScheduleEditor, CATEGORIES, HOURS, MINUTES } from './useScheduleEditor';
import { styles } from './styles';

export default function ScheduleEditorScreen() {
  const {
    categories, insets, id, isEditMode, step,
    scheduleDate, setScheduleDate, dateObj, month,
    day, title, setTitle, selectedPool,
    setSelectedPool, pools, hour, setHour,
    minute, setMinute, categoryCode, setCategoryCode,
    visibility, setVisibility, participants, currentUser,
    currentCategory, currentSelectedLicenseIds, currentNewLicenses, inProgressLicenses,
    licensesLoading, participantScrollRef, searchQuery,
    participantBottomPadding, handleParticipantLayout, handleNewParticipantLayout,
    handleSearchFocus, handleSearchSubmit, scrollParticipantIntoView, handleParticipantScrollBeginDrag,
    setSearchQuery, searching, searchError, searchInputRef,
    canRegisterTemporary, showTemporaryModal, openTemporaryModal, closeTemporaryModal,
    temporaryCategory, setTemporaryCategory, temporaryName, setTemporaryName, creatingTemporary, handleCreateTemporary,
    participantTab, handleParticipantTabChange, closeFriends, friendsLoading,
    associations, showAssociationPicker, setShowAssociationPicker, availableLicenses, availableLicensesLoading, closeLicensePicker,
    showAvailableLicensePicker, setShowAvailableLicensePicker, showPoolPicker, setShowPoolPicker,
    showHourPicker, setShowHourPicker, showMinutePicker, setShowMinutePicker,
    showDatePicker, setShowDatePicker,
    saving, loadingDetail,
    participantLabel, searchResults,
    handleNextStep, handleSelectUser, handleSelectFriend, handleRemoveCurrentUser,
    handleCurrentCategoryChange, toggleLicenseId, handleAddLicense, handleSelectAssociation,
    handleSelectNewLicense, removeNewLicense, addParticipantAndContinue, removeParticipant,
    handleSave, maskPhone, getCategoryLabel, handleBack,
  } = useScheduleEditor();
  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />

      {loadingDetail ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Spinner /></View>
      ) : (
      <>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}
        >
          <View style={styles.backCircle}>
            <Text style={styles.backArrow}>{'<'}</Text>
          </View>
        </Pressable>
        <Text style={styles.headerTitle}>
          {step === 'info' ? (isEditMode ? '일정 수정' : '다이빙 만들기') : participantLabel}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* === Step 1: Info === */}
        {step === 'info' && (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
            <Text style={styles.label}>제목</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="일정 제목을 입력해주세요"
              placeholderTextColor="rgba(255,255,255,0.25)"
            />

            <Text style={styles.label}>장소</Text>
            <Pressable style={styles.pickerButton} onPress={() => { Keyboard.dismiss(); setShowPoolPicker(true); }}>
              <Text style={[styles.pickerText, !selectedPool && styles.pickerPlaceholder]}>
                {selectedPool?.name ?? '장소를 선택해주세요'}
              </Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </Pressable>

            {!isEditMode && (
              <>
                <Text style={styles.label}>날짜</Text>
                <Pressable style={styles.dateInputRow} onPress={() => { Keyboard.dismiss(); setShowDatePicker(true); }}>
                  <Text style={styles.pickerText}>{dateObj.getFullYear()}년 {month}월 {day}일</Text>
                  <Text style={styles.calendarIcon}>📅</Text>
                </Pressable>
              </>
            )}

            <Text style={styles.label}>시간</Text>
            <View style={styles.timeRow}>
              <Pressable style={styles.timePickerButton} onPress={() => { Keyboard.dismiss(); setShowHourPicker(true); }}>
                <Text style={styles.pickerText}>{String(hour).padStart(2, '0')}</Text>
                <Text style={styles.pickerArrow}>▼</Text>
              </Pressable>
              <Text style={styles.timeLabel}>시</Text>
              <Pressable style={styles.timePickerButton} onPress={() => { Keyboard.dismiss(); setShowMinutePicker(true); }}>
                <Text style={styles.pickerText}>{String(minute).padStart(2, '0')}</Text>
                <Text style={styles.pickerArrow}>▼</Text>
              </Pressable>
              <Text style={styles.timeLabel}>분</Text>
            </View>

            <Text style={styles.label}>분류</Text>
            <ScheduleCategorySelector categories={categories} value={categoryCode} onChange={setCategoryCode} />

            <Text style={styles.label}>공개여부</Text>
            <View style={styles.visibilityRow}>
              <Text style={styles.visibilityText}>
                {visibility === 'public' ? '공개' : '비공개'}
              </Text>
              <Switch
                value={visibility === 'public'}
                onValueChange={(v) => setVisibility(v ? 'public' : 'private')}
                trackColor={{ false: 'rgba(255,255,255,0.15)', true: 'rgba(52,199,89,0.5)' }}
                thumbColor={visibility === 'public' ? Colors.brand.success : 'rgba(255,255,255,0.6)'}
                style={Platform.OS === 'android' ? { transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }], marginVertical: -10 } : undefined}
              />
            </View>
            <Text style={styles.visibilityDesc}>
              {visibility === 'public'
                ? '모든 사용자가 이 일정을 볼 수 있습니다.'
                : '친한친구만 이 일정을 볼 수 있습니다.'}
            </Text>
            <Text style={styles.visibilityDesc}>
              일정 공개여부 기본 설정은 홈 화면 우측 상단 메뉴 {'>'} 일정 설정에서 변경할 수 있습니다.
            </Text>
          </ScrollView>
        )}

        {/* === Step 2: Participant === */}
        {step === 'participant' && (
          <ScrollView ref={participantScrollRef} onLayout={handleParticipantLayout} onContentSizeChange={scrollParticipantIntoView} onScrollBeginDrag={handleParticipantScrollBeginDrag}
            style={{ flex: 1 }} contentContainerStyle={[styles.scrollContent, { paddingBottom: participantBottomPadding }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">

            {/* Already added participants */}
              <View style={styles.addedSection}>
                <View style={styles.participantSectionHeader}>
                  <Text style={styles.participantSectionTitle}>추가한 {participantLabel}</Text>
                  <View style={styles.participantCountBadge}>
                    <Text style={styles.participantCountText}>{participants.length}명</Text>
                  </View>
                </View>
                {participants.length === 0 && <Text style={styles.participantSectionHint}>아직 추가한 사람이 없어요.</Text>}
                {participants.map((p, i) => (
                  <View key={`${p.user.id}_${i}`} style={styles.addedCard}>
                    <ProfileLink userId={p.user.userId} label={p.user.nickname}>
                      <ProfileAvatar profileImage={p.user.profileImage} nickname={p.user.nickname} level={p.user.level} />
                    </ProfileLink>
                    <View style={styles.participantInfo}>
                      <ProfileLink userId={p.user.userId} label={p.user.nickname} style={styles.addedNameRow}>
                        <Text style={styles.addedName}>{p.user.nickname}{p.user.isTemporary ? ' · 임시 사용자' : ''}{p.user.name && p.user.name !== p.user.nickname ? ` (${p.user.name})` : ''}</Text>
                      </ProfileLink>
                      <Text style={styles.addedCategory}>{getCategoryLabel(p.categoryCode)}</Text>
                    </View>
                    <Pressable onPress={() => removeParticipant(i)} style={styles.addedRemove}>
                      <Text style={styles.addedRemoveText}>✕</Text>
                    </Pressable>
                  </View>
                ))}
              </View>

            <View style={styles.newParticipantSection} onLayout={handleNewParticipantLayout}>
              <View style={styles.participantSectionHeader}>
                <Text style={styles.participantSectionTitle}>{participantLabel} 추가</Text>
                <Text style={styles.newParticipantMark}>＋</Text>
              </View>
              <Text style={styles.participantSectionHint}>
                {currentUser ? '분류를 확인한 뒤 목록에 추가해주세요.' : '사용자를 검색하거나 친한친구에서 선택해주세요.'}
              </Text>

            {!currentUser ? (
              <>
                {/* Tabs */}
                <View style={styles.tabRow}>
                  <Pressable
                    style={[styles.tabItem, participantTab === 'search' && styles.tabItemActive]}
                    onPress={() => handleParticipantTabChange('search')} disabled={creatingTemporary}
                  >
                    <Text style={[styles.tabText, participantTab === 'search' && styles.tabTextActive]}>사용자 검색</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.tabItem, participantTab === 'friends' && styles.tabItemActive]}
                    onPress={() => handleParticipantTabChange('friends')} disabled={creatingTemporary}
                  >
                    <Text style={[styles.tabText, participantTab === 'friends' && styles.tabTextActive]}>친한친구</Text>
                  </Pressable>
                </View>

                {participantTab === 'search' ? (
                  <View>
                    <View>
                      <TextInput
                        ref={searchInputRef}
                        style={styles.input}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="이름, 닉네임으로 검색"
                        placeholderTextColor="rgba(255,255,255,0.25)"
                        onFocus={handleSearchFocus}
                        returnKeyType="done"
                        submitBehavior="blurAndSubmit"
                        onSubmitEditing={handleSearchSubmit}
                      />
                    </View>
                    {canRegisterTemporary && (
                      <View>
                        <Text style={styles.emptyText}>검색된 사용자가 없어요.</Text>
                        <Pressable onPress={openTemporaryModal} accessibilityRole="button" style={{ padding: 12, alignItems: 'center' }}>
                          <Text style={[styles.searchName, { textDecorationLine: 'underline' }]}>앱 미사용자로 임시 등록하시겠어요?</Text>
                        </Pressable>
                      </View>
                    )}
                    {searchError && <Text style={styles.emptyText}>검색 결과를 불러오지 못했습니다. 다시 검색해주세요.</Text>}
                    {searching && (
                      <View style={styles.searchLoading}>
                        <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
                      </View>
                    )}
                    {searchResults.length > 0 && (
                      <View style={styles.searchResults}>
                        {searchResults.map((user) => (
                          <Pressable
                            key={user.id}
                            style={({ pressed }) => [styles.searchItem, pressed && { opacity: 0.6 }]}
                            onPress={() => handleSelectUser(user)}
                            accessibilityRole="button"
                            accessibilityLabel={`${user.nickname} 선택`}
                          >
                            <ProfileLink userId={user.userId} label={user.nickname}>
                              <ProfileAvatar profileImage={user.profileImage} nickname={user.nickname} level={user.level} />
                            </ProfileLink>
                            <View style={styles.participantInfo}>
                              <View style={styles.searchNameRow}>
                                <Text style={styles.searchName}>{user.nickname}{user.isTemporary ? ' · 임시 사용자' : ''}{user.name && user.name !== user.nickname ? ` (${user.name})` : ''}</Text>
                              </View>
                              {user.phone ? <Text style={styles.searchSub}>{maskPhone(user.phone)}</Text> : null}
                            </View>
                            <Text style={styles.searchSub}>선택 ›</Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                ) : (
                  <>
                    {friendsLoading ? (
                      <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                        <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
                      </View>
                    ) : closeFriends.length === 0 ? (
                      <Text style={styles.emptyText}>등록된 친한 친구가 없습니다.</Text>
                    ) : (
                      closeFriends
                        .filter((f) => !participants.some((p) => p.user.userId === f.userId))
                        .map((friend) => (
                          <Pressable
                            key={friend.userId}
                            style={({ pressed }) => [styles.searchItem, pressed && { opacity: 0.6 }]}
                            onPress={() => handleSelectFriend(friend)}
                            accessibilityRole="button"
                            accessibilityLabel={`${friend.nickname} 선택`}
                          >
                            <ProfileLink userId={friend.userId} label={friend.nickname}>
                              <ProfileAvatar profileImage={friend.profileImage} nickname={friend.nickname} level={friend.level} />
                            </ProfileLink>
                            <View style={styles.participantInfo}>
                              <View style={styles.searchNameRow}>
                                <Text style={styles.searchName}>{friend.nickname}{friend.isTemporary ? ' · 임시 사용자' : ''}{friend.name && friend.name !== friend.nickname ? ` (${friend.name})` : ''}</Text>
                              </View>
                            </View>
                            <Text style={styles.searchSub}>선택 ›</Text>
                          </Pressable>
                        ))
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                {/* Selected user card */}
                <View style={styles.selectedCard}>
                  <ProfileLink userId={currentUser.userId} label={currentUser.nickname}>
                    <ProfileAvatar profileImage={currentUser.profileImage} nickname={currentUser.nickname} level={currentUser.level} />
                  </ProfileLink>
                  <View style={styles.participantInfo}>
                    <ProfileLink userId={currentUser.userId} label={currentUser.nickname} style={styles.searchNameRow}>
                      <Text style={styles.searchName}>{currentUser.nickname}{currentUser.isTemporary ? ' · 임시 사용자' : ''}{currentUser.name && currentUser.name !== currentUser.nickname ? ` (${currentUser.name})` : ''}</Text>
                    </ProfileLink>
                    {currentUser.phone ? <Text style={styles.searchSub}>{maskPhone(currentUser.phone)}</Text> : null}
                  </View>
                  <Pressable onPress={handleRemoveCurrentUser} style={styles.addedRemove}>
                    <Text style={styles.addedRemoveText}>✕</Text>
                  </Pressable>
                </View>

                {/* Category picker for this participant */}
                <Text style={styles.label}>다이빙 구분</Text>
                <ScheduleCategorySelector categories={categories} value={currentCategory} onChange={handleCurrentCategoryChange} />

                {/* License section for CERTIFICATION */}
                {currentCategory === 'CERTIFICATION' && (
                  <View style={styles.licenseSection}>
                    <Text style={styles.label}>자격증 과정</Text>

                    {licensesLoading ? (
                      <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                        <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
                      </View>
                    ) : (
                      <>
                        {inProgressLicenses.length === 0 && currentNewLicenses.length === 0 && (
                          <Text style={styles.emptyText}>
                            진행중인 자격증 과정이 없습니다.{'\n'}아래 버튼으로 자격증 과정을 추가해주세요.
                          </Text>
                        )}

                        {/* In-progress licenses */}
                        {inProgressLicenses.map((lic) => {
                          const selected = currentSelectedLicenseIds.includes(lic.userLicenseId);
                          return (
                            <Pressable
                              key={lic.userLicenseId}
                              style={[styles.licenseItem, selected && styles.licenseItemSelected]}
                              onPress={() => toggleLicenseId(lic.userLicenseId)}
                            >
                              <View style={[styles.checkbox, selected && styles.checkboxChecked]}>
                                {selected && <Text style={styles.checkmark}>✓</Text>}
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.licenseName}>{lic.nameKo}</Text>
                                <Text style={styles.licenseAssoc}>{lic.associationName}</Text>
                              </View>
                            </Pressable>
                          );
                        })}

                        {/* Newly added licenses */}
                        {currentNewLicenses.map((lic) => (
                          <View key={lic.licenseId} style={[styles.licenseItem, styles.licenseItemSelected]}>
                            <View style={[styles.checkbox, styles.checkboxChecked, styles.checkboxNew]}>
                              <Text style={styles.checkmark}>+</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.licenseName}>{lic.nameKo}</Text>
                              <Text style={styles.licenseNew}>신규 등록</Text>
                            </View>
                            <Pressable onPress={() => removeNewLicense(lic.licenseId)} style={styles.addedRemove}>
                              <Text style={styles.addedRemoveText}>✕</Text>
                            </Pressable>
                          </View>
                        ))}

                        {/* Add license button */}
                        <Pressable
                          style={({ pressed }) => [styles.addLicenseButton, pressed && { opacity: 0.7 }]}
                          onPress={handleAddLicense}
                        >
                          <Text style={styles.addLicenseText}>+ 자격증 과정 추가</Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                )}
              </>
            )}

            </View>
          </ScrollView>
        )}

        {/* Bottom buttons - always fixed, KeyboardAvoidingView pushes above keyboard */}
        <View style={styles.bottomArea}>
          {step === 'info' ? (
            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && { opacity: 0.85 }]}
              onPress={handleNextStep}
            >
              <Text style={styles.primaryButtonText}>다음</Text>
            </Pressable>
          ) : (
            <View style={styles.bottomRow}>
              {currentUser && (
                <Pressable
                  style={({ pressed }) => [styles.secondaryButton, pressed && { opacity: 0.85 }]}
                  onPress={addParticipantAndContinue}
                >
                  <Text style={styles.secondaryButtonText}>목록에 추가</Text>
                </Pressable>
              )}
              <Pressable
                style={({ pressed }) => [styles.primaryButton, { flex: 1 }, pressed && { opacity: 0.85 }]}
                onPress={handleSave}
                disabled={saving || creatingTemporary}
              >
                {saving ? (
                  <ActivityIndicator color={Colors.brand.primary} />
                ) : (
                  <Text style={styles.primaryButtonText}>{isEditMode ? '일정 수정' : '일정 저장'}</Text>
                )}
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      <Modal visible={showTemporaryModal} transparent animationType="fade" onRequestClose={closeTemporaryModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.temporaryOverlay}>
          <PopupBackdrop />
          <View style={styles.temporaryDialog} accessibilityViewIsModal>
            <Text style={styles.headerTitle}>앱 미사용자 임시 등록</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>이름</Text>
              <TextInput style={styles.input} value={temporaryName} onChangeText={setTemporaryName}
                placeholder="이름" placeholderTextColor="rgba(255,255,255,0.25)" maxLength={50}
                editable={!creatingTemporary} accessibilityLabel="임시 사용자 이름" />
              <Text style={styles.label}>일정 분류</Text>
              <ScheduleCategorySelector categories={categories} value={temporaryCategory}
                onChange={setTemporaryCategory} disabled={creatingTemporary} />
            </ScrollView>
            <View style={[styles.bottomRow, { marginTop: 20 }]}>
              <Pressable onPress={closeTemporaryModal} disabled={creatingTemporary} style={styles.secondaryButton} accessibilityRole="button">
                <Text style={styles.secondaryButtonText}>취소</Text>
              </Pressable>
              <Pressable onPress={handleCreateTemporary} disabled={creatingTemporary || !temporaryName.trim() || !temporaryCategory}
                style={[styles.primaryButton, { flex: 1 }]} accessibilityRole="button">
                {creatingTemporary ? <ActivityIndicator color={Colors.brand.primary} /> : <Text style={styles.primaryButtonText}>확인</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Picker Modals */}
      <DatePickerSheet
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        selectedDate={scheduleDate}
        onSelect={(v) => setScheduleDate(v)}
      />
      <BottomSheet
        visible={showPoolPicker} onClose={() => setShowPoolPicker(false)} title="장소 선택"
        items={pools.map((p) => ({ label: p.name, value: p }))}
        onSelect={(v) => setSelectedPool(v)} selectedValue={selectedPool} searchable
      />
      <BottomSheet
        visible={showHourPicker} onClose={() => setShowHourPicker(false)} title="시"
        items={HOURS.map((h) => ({ label: `${String(h).padStart(2, '0')}시`, value: h }))}
        onSelect={(v) => setHour(v)} selectedValue={hour}
      />
      <BottomSheet
        visible={showMinutePicker} onClose={() => setShowMinutePicker(false)} title="분"
        items={MINUTES.map((m) => ({ label: `${String(m).padStart(2, '0')}분`, value: m }))}
        onSelect={(v) => setMinute(v)} selectedValue={minute}
      />
      <BottomSheet
        visible={showAssociationPicker || showAvailableLicensePicker}
        onClose={closeLicensePicker}
        title={showAvailableLicensePicker ? '자격증 선택' : '협회 선택'}
        loading={availableLicensesLoading}
        closeOnSelect={showAvailableLicensePicker}
        items={showAvailableLicensePicker
          ? availableLicenses.map((l) => ({ label: l.nameKo, value: l }))
          : associations.map((a) => ({ label: a.name, value: a.id }))}
        onSelect={(value) => showAvailableLicensePicker ? handleSelectNewLicense(value) : handleSelectAssociation(value)}
      />
      </>
      )}
    </View>
  );
}
