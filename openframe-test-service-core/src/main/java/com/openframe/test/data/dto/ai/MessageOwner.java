package com.openframe.test.data.dto.ai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class MessageOwner {
    private MessageOwnerType type;

    // AssistantOwner only: the model id the agent resolved for this reply (e.g. "gpt-5.5"), and its
    // display name and provider. Filled from the assistant's settings when the message is saved.
    private String model;
    private String modelName;
    private String providerName;
}
