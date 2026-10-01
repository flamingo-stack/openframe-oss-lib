package com.openframe.test.api.graphql;

// Personal "Get Started" onboarding documents on api/graphql; every mutation answers with the full progress object.
public class OnboardingQueries {

    private static final String USER_PROGRESS_FIELDS = """
            completedSteps
            completed
            completedAt
            skipped
            skippedAt
            """;

    public static final String USER_ONBOARDING_PROGRESS = """
            query UserOnboardingProgress {
                userOnboardingProgress {
                    %s
                }
            }
            """.formatted(USER_PROGRESS_FIELDS);

    public static final String COMPLETE_USER_ONBOARDING_STEP = """
            mutation CompleteUserOnboardingStep($step: UserOnboardingStep!) {
                completeUserOnboardingStep(step: $step) {
                    %s
                }
            }
            """.formatted(USER_PROGRESS_FIELDS);

    public static final String COMPLETE_USER_ONBOARDING = """
            mutation CompleteUserOnboarding {
                completeUserOnboarding {
                    %s
                }
            }
            """.formatted(USER_PROGRESS_FIELDS);

    public static final String SKIP_USER_ONBOARDING = """
            mutation SkipUserOnboarding {
                skipUserOnboarding {
                    %s
                }
            }
            """.formatted(USER_PROGRESS_FIELDS);

    public static final String RESET_USER_ONBOARDING = """
            mutation ResetUserOnboarding {
                resetUserOnboarding {
                    %s
                }
            }
            """.formatted(USER_PROGRESS_FIELDS);
}
