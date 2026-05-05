package com.openframe.data.document.notification;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;
import lombok.experimental.SuperBuilder;

/**
 * Fallback context for untyped events; also Jackson's {@code defaultImpl}
 * for unknown {@code type} tokens so unknown rows still deserialise.
 *
 * <p>If a notification has structured fields, declare a proper
 * {@link NotificationContext} subclass — do not pack typed data into
 * {@code payload}.
 */
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@ToString(callSuper = true)
public class GenericContext extends NotificationContext {

    private String payload;
}
