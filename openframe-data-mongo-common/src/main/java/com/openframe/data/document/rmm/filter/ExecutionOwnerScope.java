package com.openframe.data.document.rmm.filter;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class ExecutionOwnerScope {

    private final Type type;
    private final String id;

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
