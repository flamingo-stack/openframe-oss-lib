package com.openframe.test.helpers.ai;

import com.openframe.test.api.AiSettingsApi;
import com.openframe.test.data.dto.aisettings.AgentAiConfig;
import com.openframe.test.data.dto.aisettings.AgentAiConfigInput;
import com.openframe.test.data.dto.aisettings.AgentAiConfigPayload;
import com.openframe.test.data.dto.aisettings.SupportedModel;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Switches an assistant's model through its tenant-wide AI config, the way a technician does in the AI
 * settings, and puts it back. The setting is read on every run, so a switch between two messages of the
 * same chat answers the second one on the new model.
 *
 * <p>The target is taken from the environment's supported list, never named: qa and stage offer different
 * models, and an unlisted model silently falls back to the provider default.
 */
public class ModelSwitch {

    private static final String ANTHROPIC = "ANTHROPIC";

    /** A provider and one of its models, as the AI config stores them. */
    public record Choice(String provider, String model) {
        static Choice of(AgentAiConfig config) {
            return new Choice(config.getLlmProvider(), config.getProviderModel());
        }
    }

    /** The configuration in effect before a case switched it. */
    public static Choice current(AgentAiConfig config) {
        assertThat(config).as("The assistant has an AI config to switch from").isNotNull();
        return Choice.of(config);
    }

    /**
     * The model to switch to: another Claude model, a Sonnet when one is listed. A Claude-to-GPT switch is
     * what this should be, but the assistants cannot answer on the environment's GPT models yet ("Function
     * tools with reasoning_effort are not supported for gpt-5.x in /v1/chat/completions", reported as a
     * product bug); move the target back to the other provider once they do.
     */
    public static Choice target(Choice from) {
        List<SupportedModel> candidates = AiSettingsApi.supportedModels().values().stream()
                .flatMap(List::stream)
                .filter(m -> ANTHROPIC.equals(m.getProvider()))
                .filter(m -> !m.getModelName().equals(from.model()))
                .sorted(Comparator.comparing(m -> !m.getModelName().toLowerCase(Locale.ROOT).contains("sonnet")))
                .toList();
        assertThat(candidates)
                .as("The environment must offer another Claude model to switch to from %s", from)
                .isNotEmpty();
        return new Choice(ANTHROPIC, candidates.getFirst().getModelName());
    }

    /** Stores {@code to} through the given update mutation and asserts it was accepted as sent. */
    public static void apply(Function<AgentAiConfigInput, AgentAiConfigPayload> update, Choice to) {
        AgentAiConfigPayload payload = update.apply(AgentAiConfigInput.builder()
                .llmProvider(to.provider())
                .providerModel(to.model())
                .build());
        assertThat(payload.getUserErrors()).as("Switching the model to %s reports no userErrors", to).isEmpty();
        assertThat(payload.getAiConfig().getProviderModel()).as("The config stores the model it was given")
                .isEqualTo(to.model());
    }
}
