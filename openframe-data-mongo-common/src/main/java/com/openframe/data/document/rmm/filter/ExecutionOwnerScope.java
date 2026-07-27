package com.openframe.data.document.rmm.filter;

public record ExecutionOwnerScope(Type type, String id) {

    public enum Type {
        SCRIPT, SCHEDULE
    }

    public static ExecutionOwnerScope forScript(String scriptId) {
        return new ExecutionOwnerScope(Type.SCRIPT, scriptId);
    }

    public static ExecutionOwnerScope forSchedule(String scheduleId) {
        return new ExecutionOwnerScope(Type.SCHEDULE, scheduleId);
    }
}
