import { useNavigate } from "@tanstack/react-router";
import type { ProviderInstanceId } from "@t3tools/contracts";
import { createModelSelection } from "@t3tools/shared/model";

import {
  useScopedSettings,
  useScopedSettingsMixed,
  useUpdateScopedSettings,
} from "./useScopedSettings";
import { useScopedModelDisabledReason } from "./useScopedModelAvailability";
import { useSettingsScope } from "./SettingsScopeContext";
import {
  applyProviderInstanceSettings,
  deriveProviderInstanceEntries,
  sortProviderInstanceEntries,
} from "../../providerInstances";
import { getCustomModelOptionsByInstance } from "../../modelSelection";
import { EMPTY_SERVER_PROVIDERS } from "../../state/server";
import { ProviderModelPicker } from "../chat/ProviderModelPicker";
import { Switch } from "../ui/switch";
import { toastManager } from "../ui/toast";
import {
  SETTINGS_PICKER_TRIGGER_CLASSNAME,
  SettingResetButton,
  SettingsRow,
  SettingsSection,
} from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";

/**
 * Fusion: top-level threads lead and hand execution to a sidekick model. The
 * server owns the behavior (RuntimePolicy.resolveFusionSidekick); this row only
 * chooses the sidekick or turns Fusion off.
 */
export function FusionSettingsSection() {
  const settings = useScopedSettings();
  const updateSettings = useUpdateScopedSettings();
  const navigate = useNavigate();
  const { environment, connectedEnvironments } = useSettingsScope();
  const environmentId = environment?.environmentId ?? null;
  const serverProviders = environment?.serverConfig?.providers ?? EMPTY_SERVER_PROVIDERS;
  const mixed = useScopedSettingsMixed(["fusionSidekick"]);
  const sidekick = settings.fusionSidekick;
  const instanceEntries = sortProviderInstanceEntries(
    applyProviderInstanceSettings(deriveProviderInstanceEntries(serverProviders), settings),
  );
  const usable = instanceEntries.filter((entry) => entry.enabled && entry.isAvailable);
  // Turning Fusion on proposes a Pi instance first: it is the harness local models run in.
  const proposed = usable.find((entry) => entry.driverKind === "pi") ?? usable[0];
  const proposedModel = proposed?.models[0]?.slug;
  const modelOptionsByInstance = getCustomModelOptionsByInstance(
    settings,
    serverProviders,
    sidekick?.instanceId ?? proposed?.instanceId,
    sidekick?.model ?? proposedModel,
  );
  const disabledReason = useScopedModelDisabledReason(settings, instanceEntries);

  return (
    <SettingsSection id="fusion" title="Fusion">
      <SettingsRow
        serverScoped
        settingKeys={["fusionSidekick"]}
        mixed={mixed}
        {...searchableSetting("fusion-sidekick")}
        description="Top-level threads lead: they plan, brief, review and accept, and hand exploration, edits and checks to this sidekick model. Off runs threads as usual."
        resetAction={
          sidekick !== null ? (
            <SettingResetButton
              label="Fusion sidekick"
              onClick={() => updateSettings({ fusionSidekick: null })}
            />
          ) : null
        }
        control={
          connectedEnvironments.length === 0 ? (
            <span className="text-sm text-muted-foreground">
              Connect an environment to choose its Fusion sidekick.
            </span>
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {sidekick !== null ? (
                <ProviderModelPicker
                  activeInstanceId={sidekick.instanceId}
                  model={sidekick.model}
                  lockedProvider={null}
                  instanceEntries={instanceEntries}
                  modelOptionsByInstance={modelOptionsByInstance}
                  triggerClassName={SETTINGS_PICKER_TRIGGER_CLASSNAME}
                  triggerAriaLabel="Fusion sidekick model"
                  {...(mixed ? { triggerLabel: "Mixed" } : {})}
                  {...(environmentId
                    ? {
                        onOpenProviderSetup: (instanceId: ProviderInstanceId) => {
                          void navigate({
                            to: "/settings/providers",
                            search: { environmentId, instanceId },
                          });
                        },
                      }
                    : {})}
                  getModelDisabledReason={disabledReason}
                  onInstanceModelChange={(instanceId, model) => {
                    const reason = disabledReason(instanceId, model);
                    if (reason) {
                      toastManager.add({
                        type: "error",
                        title: "Fusion sidekick not saved",
                        description: reason,
                      });
                      return;
                    }
                    updateSettings({ fusionSidekick: createModelSelection(instanceId, model) });
                  }}
                />
              ) : null}
              <Switch
                checked={sidekick !== null}
                disabled={sidekick === null && proposedModel === undefined}
                onCheckedChange={(checked) =>
                  updateSettings({
                    fusionSidekick:
                      checked && proposed !== undefined && proposedModel !== undefined
                        ? createModelSelection(proposed.instanceId, proposedModel)
                        : null,
                  })
                }
                aria-label="Use Fusion with a sidekick model"
              />
            </div>
          )
        }
      />
    </SettingsSection>
  );
}
