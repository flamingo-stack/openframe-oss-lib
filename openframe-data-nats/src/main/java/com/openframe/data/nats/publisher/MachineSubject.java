package com.openframe.data.nats.publisher;

import lombok.NoArgsConstructor;

import java.util.regex.Pattern;

import static org.apache.commons.lang3.StringUtils.isBlank;

@NoArgsConstructor
public final class MachineSubject {

    /** Subject-safe single token: letters, digits, hyphen and underscore only. */
    private static final Pattern SUBJECT_SAFE_TOKEN = Pattern.compile("^[A-Za-z0-9_-]+$");

    public static void validateMachineId(String machineId) {
        if (isBlank(machineId)) {
            throw new IllegalArgumentException("machineId must not be blank");
        }
        if (!SUBJECT_SAFE_TOKEN.matcher(machineId).matches()) {
            throw new IllegalArgumentException(
                    "machineId is not a valid NATS subject token (allowed chars: A-Za-z0-9_-): " + machineId);
        }
    }
}
