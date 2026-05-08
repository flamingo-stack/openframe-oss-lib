package com.openframe.data.document.notification;

import com.fasterxml.jackson.annotation.JsonTypeInfo;

@JsonTypeInfo(use = JsonTypeInfo.Id.CLASS, include = JsonTypeInfo.As.PROPERTY, property = "_class")
public sealed interface Recipient permits UserRecipient, MachineRecipient, BroadcastRecipient {
}
