package expo.modules.divelive

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

// 다가오는 다이빙 Live Update (안드로이드, 2026-11-22). iOS 라이브 액티비티와 같은 정보를 구글 기본 알림 모양으로.
// - 안드로이드 16+: 'Live Update'로 올려 달라고 요청 → 상태바 칩(남은 시간) · 잠금화면 · 알림창 맨 위
// - 그보다 낮으면 같은 내용의 밀어서 못 지우는 고정 알림
// - 남은 시간은 알림의 카운트다운(크로노미터)이라 시스템이 알아서 줄임. 시작 30분 뒤 시스템이 지움
class DiveProps : Record {
  @Field var scheduleId: Int = 0
  @Field var title: String = ""
  @Field var place: String = ""
  @Field var timeLabel: String = ""
  @Field var dayLabel: String = ""
  @Field var category: String = ""
  @Field var people: Int = 0
  @Field var startAt: Double = 0.0
  @Field var started: Boolean = false
}

class DiveLiveUpdateModule : Module() {
  private val channelId = "dive_live_update"
  private val notificationId = 47_301 // 한 번에 하나만
  private val keepAfterMs = 30 * 60 * 1000L

  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("No context")

  override fun definition() = ModuleDefinition {
    Name("DiveLiveUpdate")

    // 알림을 띄울 수 있는지 (권한 · 사용자 설정)
    Function("canPost") { NotificationManagerCompat.from(context).areNotificationsEnabled() }

    // 안드로이드 16+에서 이 앱이 Live Update로 올라갈 수 있는지 (사용자가 끄면 false)
    Function("canPromote") {
      if (Build.VERSION.SDK_INT >= 36) {
        context.getSystemService(NotificationManager::class.java).canPostPromotedNotifications()
      } else false
    }

    // 띄우기 · 고치기 (같은 id라 제자리에서 바뀜)
    Function("show") { props: DiveProps ->
      ensureChannel()
      val startAt = props.startAt.toLong()
      val info = listOfNotNull(
        props.place.takeIf { it.isNotBlank() },
        "${props.dayLabel} ${props.timeLabel} 시작",
        if (props.people > 0) "함께하는 인원 ${props.people}명" else null,
      )
      val intent = Intent(Intent.ACTION_VIEW, Uri.parse("allblue://schedule-detail?id=${props.scheduleId}"))
        .setPackage(context.packageName)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      val pending = PendingIntent.getActivity(
        context, props.scheduleId, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
      val builder = NotificationCompat.Builder(context, channelId)
        .setSmallIcon(smallIcon())
        .setContentTitle(props.title)
        .setContentText(info.joinToString(" · "))
        .setStyle(NotificationCompat.BigTextStyle().bigText(info.joinToString("\n")))
        .setSubText(if (props.category.isNotBlank()) "allblue · ${props.category}" else "allblue")
        .setColor(0xFF144A84.toInt())
        .setOngoing(true)
        // '무음' 알림으로 두면 잠금화면에서 무음 알림을 숨기는 폰에서 안 보여서, 소리 · 진동 없는 채널 + 한 번만 알림으로 조용하게
        .setOnlyAlertOnce(true)
        .setCategory(NotificationCompat.CATEGORY_EVENT)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setContentIntent(pending)
        .setWhen(startAt)
        .setShowWhen(true)
      if (props.started || System.currentTimeMillis() >= startAt) {
        // 시작 뒤: 칩에는 '다이빙 중'
        builder.setUsesChronometer(false)
        builder.addExtras(Bundle().apply { putCharSequence("android.shortCriticalText", "다이빙 중") })
      } else {
        builder.setUsesChronometer(true).setChronometerCountDown(true)
      }
      val remain = startAt + keepAfterMs - System.currentTimeMillis()
      if (remain > 0) builder.setTimeoutAfter(remain)
      // Live Update로 올려 달라는 요청 (Notification.EXTRA_REQUEST_PROMOTED_ONGOING, 안드로이드 16+에서만 의미 있음)
      builder.addExtras(Bundle().apply { putBoolean("android.requestPromotedOngoing", true) })
      try {
        NotificationManagerCompat.from(context).notify(notificationId, builder.build())
        true
      } catch (e: SecurityException) {
        false // 알림 권한 없음
      }
    }

    Function("end") { NotificationManagerCompat.from(context).cancel(notificationId) }
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < 26) return
    val manager = context.getSystemService(NotificationManager::class.java)
    if (manager.getNotificationChannel(channelId) != null) return
    // Live Update는 소리 없는 '기본' 중요도 이상이어야 올라감 (최소 중요도는 안 됨)
    val channel = NotificationChannel(channelId, "다가오는 다이빙", NotificationManager.IMPORTANCE_DEFAULT).apply {
      description = "다가오는 다이빙 일정까지 남은 시간"
      setSound(null, null)
      enableVibration(false)
      setShowBadge(false)
    }
    manager.createNotificationChannel(channel)
  }

  private fun smallIcon(): Int {
    val res = context.resources
    val id = res.getIdentifier("notification_icon", "drawable", context.packageName)
    return if (id != 0) id else context.applicationInfo.icon
  }
}
