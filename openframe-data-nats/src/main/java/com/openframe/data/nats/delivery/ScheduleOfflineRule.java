package com.openframe.data.nats.delivery;

import com.openframe.data.document.delivery.DeliveryOfflineBehavior;
import com.openframe.data.document.rmm.schedule.ScheduleOfflineBehavior;
import com.openframe.data.document.rmm.schedule.ScheduleScriptTrigger;

// what a schedule asks for a machine that is not online when it fires, as the engine takes it: skip, or wait for the
// reconnect within the schedule's window. One place for the rule, read by every path that sends a fire
public record ScheduleOfflineRule(DeliveryOfflineBehavior behavior, Long reconnectWindowSeconds) {

    public static final ScheduleOfflineRule SKIP = new ScheduleOfflineRule(DeliveryOfflineBehavior.SKIP, null);

    public static ScheduleOfflineRule of(ScheduleScriptTrigger trigger, ScheduleOfflineBehavior offlineBehavior, Long reconnectWindowSeconds) {
        if (isRetryOnReconnect(trigger, offlineBehavior, reconnectWindowSeconds)) {
            return waitingFor(reconnectWindowSeconds);
        }
        return SKIP;
    }

    public static ScheduleOfflineRule waitingFor(long reconnectWindowSeconds) {
        return new ScheduleOfflineRule(DeliveryOfflineBehavior.RETRY_ON_RECONNECT, reconnectWindowSeconds);
    }

    public boolean isWaiting() {
        return behavior == DeliveryOfflineBehavior.RETRY_ON_RECONNECT;
    }

    // only a fire at a date and time waits; the trigger on a device coming online fires on a machine that is online
    private static boolean isRetryOnReconnect(ScheduleScriptTrigger trigger, ScheduleOfflineBehavior offlineBehavior, Long reconnectWindowSeconds) {
        return trigger == ScheduleScriptTrigger.DATE_TIME
                && offlineBehavior == ScheduleOfflineBehavior.RETRY_ON_RECONNECT
                && reconnectWindowSeconds != null
                && reconnectWindowSeconds > 0;
    }
}
