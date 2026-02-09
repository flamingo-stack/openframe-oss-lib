package com.openframe.data.document.clientconfiguration;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PublishState {

    private boolean published;
    private Instant publishedAt;
    private int attempts;
}
