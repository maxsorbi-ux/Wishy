import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import * as Clipboard from "expo-clipboard";
import Constants from "expo-constants";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

// Timeout configurations (in milliseconds)
const TIMEOUTS = {
  PERMISSION_CHECK: 5000,      // 5 seconds
  PERMISSION_REQUEST: 10000,   // 10 seconds
  APNS_TOKEN: 30000,           // 30 seconds
  EXPO_TOKEN: 15000,           // 15 seconds
  PROJECT_ID: 2000,            // 2 seconds
};

interface LogEntry {
  timestamp: string;
  message: string;
  type: "info" | "success" | "error" | "warning";
}

interface PermissionInfo {
  existingStatus: string | null;
  finalStatus: string | null;
  canAskAgain: boolean | null;
}

interface TokenInfo {
  expoPushToken: string | null;
  expoPushTokenError: string | null;
  apnsDeviceToken: string | null;
  apnsDeviceTokenError: string | null;
  projectId: string | null;
  projectIdSource: string | null;
}

type StepStatus = "idle" | "running" | "success" | "error" | "timeout";

interface StepState {
  status: StepStatus;
  elapsed: number;
  timeout: number;
  message: string;
}

interface DiagnosticSteps {
  projectId: StepState;
  permissionCheck: StepState;
  permissionRequest: StepState;
  apnsToken: StepState;
  expoToken: StepState;
}

const initialStepState = (timeout: number): StepState => ({
  status: "idle",
  elapsed: 0,
  timeout,
  message: "",
});

export default function PushDebugScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [fetchingTokens, setFetchingTokens] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [permissionInfo, setPermissionInfo] = useState<PermissionInfo>({
    existingStatus: null,
    finalStatus: null,
    canAskAgain: null,
  });
  const [tokenInfo, setTokenInfo] = useState<TokenInfo>({
    expoPushToken: null,
    expoPushTokenError: null,
    apnsDeviceToken: null,
    apnsDeviceTokenError: null,
    projectId: null,
    projectIdSource: null,
  });
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [diagnosticSteps, setDiagnosticSteps] = useState<DiagnosticSteps>({
    projectId: initialStepState(TIMEOUTS.PROJECT_ID),
    permissionCheck: initialStepState(TIMEOUTS.PERMISSION_CHECK),
    permissionRequest: initialStepState(TIMEOUTS.PERMISSION_REQUEST),
    apnsToken: initialStepState(TIMEOUTS.APNS_TOKEN),
    expoToken: initialStepState(TIMEOUTS.EXPO_TOKEN),
  });
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const hasLoadedOnce = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentStepRef = useRef<keyof DiagnosticSteps | null>(null);

  const addLog = useCallback((message: string, type: LogEntry["type"] = "info") => {
    const now = new Date();
    const timestamp = now.toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setLogs((prev) => [...prev, { timestamp, message, type }]);
  }, []);

  // Update step state helper
  const updateStep = useCallback((
    stepKey: keyof DiagnosticSteps,
    updates: Partial<StepState>
  ) => {
    setDiagnosticSteps((prev) => ({
      ...prev,
      [stepKey]: { ...prev[stepKey], ...updates },
    }));
  }, []);

  // Start timer for a step
  const startStepTimer = useCallback((stepKey: keyof DiagnosticSteps) => {
    currentStepRef.current = stepKey;
    const startTime = Date.now();

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setDiagnosticSteps((prev) => ({
        ...prev,
        [stepKey]: { ...prev[stepKey], elapsed },
      }));
    }, 100);
  }, []);

  // Stop timer
  const stopStepTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    currentStepRef.current = null;
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Helper to run async operation with timeout
  const withTimeout = useCallback(<T,>(
    promise: Promise<T>,
    timeoutMs: number,
    stepName: string
  ): Promise<T> => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`TIMEOUT: ${stepName} non ha risposto entro ${timeoutMs / 1000}s`));
      }, timeoutMs);

      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }, []);

  const getProjectId = useCallback((): { id: string | null; source: string } => {
    // Try Constants.easConfig.projectId first
    const easConfigProjectId = Constants.easConfig?.projectId;
    if (easConfigProjectId) {
      return { id: easConfigProjectId, source: "Constants.easConfig.projectId" };
    }

    // Try Constants.expoConfig.extra.eas.projectId
    const expoConfigProjectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (expoConfigProjectId) {
      return { id: expoConfigProjectId, source: "Constants.expoConfig.extra.eas.projectId" };
    }

    // Try manifest2 (for EAS builds)
    const manifest2ProjectId = (Constants.manifest2 as { extra?: { eas?: { projectId?: string } } } | null)?.extra?.eas?.projectId;
    if (manifest2ProjectId) {
      return { id: manifest2ProjectId, source: "Constants.manifest2.extra.eas.projectId" };
    }

    return { id: null, source: "NOT FOUND" };
  }, []);

  const checkPermissions = useCallback(async () => {
    addLog("Step: Verifica permessi esistenti...", "info");
    updateStep("permissionCheck", { status: "running", elapsed: 0, message: "Verificando permessi..." });
    startStepTimer("permissionCheck");

    try {
      const permissionPromise = Notifications.getPermissionsAsync();
      const { status: existingStatus, canAskAgain } = await withTimeout(
        permissionPromise,
        TIMEOUTS.PERMISSION_CHECK,
        "Verifica Permessi"
      );

      stopStepTimer();
      setPermissionInfo((prev) => ({
        ...prev,
        existingStatus,
        canAskAgain: canAskAgain ?? null,
      }));

      const isGranted = existingStatus === "granted";
      updateStep("permissionCheck", {
        status: isGranted ? "success" : "error",
        message: isGranted ? `Permessi OK: ${existingStatus}` : `Permessi: ${existingStatus}`,
      });

      addLog(`existingStatus: ${existingStatus}`, isGranted ? "success" : "warning");
      addLog(`canAskAgain: ${canAskAgain}`, "info");

      return { existingStatus, canAskAgain };
    } catch (error) {
      stopStepTimer();
      const errorMsg = error instanceof Error ? error.message : String(error);
      const isTimeout = errorMsg.includes("TIMEOUT");

      updateStep("permissionCheck", {
        status: isTimeout ? "timeout" : "error",
        message: errorMsg,
      });

      addLog(`Errore verifica permessi: ${errorMsg}`, "error");
      return { existingStatus: null, canAskAgain: null };
    }
  }, [addLog, updateStep, startStepTimer, stopStepTimer, withTimeout]);

  const requestPermissions = async () => {
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addLog("Step: Richiesta permessi notifiche...", "info");
    updateStep("permissionRequest", { status: "running", elapsed: 0, message: "Richiedendo permessi..." });
    startStepTimer("permissionRequest");

    try {
      const getPermPromise = Notifications.getPermissionsAsync();
      const { status: existingStatus } = await withTimeout(
        getPermPromise,
        TIMEOUTS.PERMISSION_CHECK,
        "Verifica Permessi Esistenti"
      );

      if (existingStatus === "granted") {
        stopStepTimer();
        addLog("Permessi gia concessi", "success");
        setPermissionInfo((prev) => ({ ...prev, existingStatus, finalStatus: existingStatus }));
        updateStep("permissionRequest", {
          status: "success",
          message: "Permessi gia concessi",
        });
        setLoading(false);
        return;
      }

      addLog("Permessi non concessi, richiedendo...", "info");
      const requestPromise = Notifications.requestPermissionsAsync();
      const { status: finalStatus, canAskAgain } = await withTimeout(
        requestPromise,
        TIMEOUTS.PERMISSION_REQUEST,
        "Richiesta Permessi"
      );

      stopStepTimer();
      setPermissionInfo({
        existingStatus,
        finalStatus,
        canAskAgain: canAskAgain ?? null,
      });

      if (finalStatus === "granted") {
        updateStep("permissionRequest", {
          status: "success",
          message: `Permessi concessi: ${finalStatus}`,
        });
        addLog(`Permessi concessi! finalStatus: ${finalStatus}`, "success");
      } else {
        updateStep("permissionRequest", {
          status: "error",
          message: `Permessi negati: ${finalStatus}`,
        });
        addLog(`Permessi negati. finalStatus: ${finalStatus}, canAskAgain: ${canAskAgain}`, "error");
      }
    } catch (error) {
      stopStepTimer();
      const errorMsg = error instanceof Error ? error.message : String(error);
      const isTimeout = errorMsg.includes("TIMEOUT");

      updateStep("permissionRequest", {
        status: isTimeout ? "timeout" : "error",
        message: errorMsg,
      });

      addLog(`Errore richiesta permessi: ${errorMsg}`, "error");
      try {
        addLog(`Dettaglio errore: ${JSON.stringify(error)}`, "error");
      } catch {
        // ignore JSON stringify errors
      }
    }

    setLoading(false);
  };

  const fetchTokens = async () => {
    setFetchingTokens(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Step 1: Get Project ID
    addLog("=== STEP 1/3: Recupero Project ID ===", "info");
    updateStep("projectId", { status: "running", elapsed: 0, message: "Cercando Project ID..." });
    startStepTimer("projectId");

    try {
      const projectIdPromise = new Promise<{ id: string | null; source: string }>((resolve) => {
        const result = getProjectId();
        resolve(result);
      });

      const { id: projectId, source: projectIdSource } = await withTimeout(
        projectIdPromise,
        TIMEOUTS.PROJECT_ID,
        "Recupero Project ID"
      );

      stopStepTimer();
      setTokenInfo((prev) => ({ ...prev, projectId, projectIdSource }));

      if (projectId) {
        updateStep("projectId", {
          status: "success",
          message: `Trovato: ${projectId.substring(0, 12)}...`,
        });
        addLog(`Project ID: ${projectId}`, "success");
        addLog(`Source: ${projectIdSource}`, "info");
      } else {
        updateStep("projectId", {
          status: "error",
          message: "Project ID NON TROVATO",
        });
        addLog(`Project ID: NON TROVATO (source: ${projectIdSource})`, "error");
      }
    } catch (error) {
      stopStepTimer();
      const errorMsg = error instanceof Error ? error.message : String(error);
      updateStep("projectId", {
        status: errorMsg.includes("TIMEOUT") ? "timeout" : "error",
        message: errorMsg,
      });
      addLog(`Errore Project ID: ${errorMsg}`, "error");
    }

    // Step 2: Get APNs Device Token (iOS only)
    if (Platform.OS === "ios") {
      addLog("=== STEP 2/3: Recupero APNs Device Token ===", "info");
      addLog(`Timeout impostato: ${TIMEOUTS.APNS_TOKEN / 1000}s`, "info");
      updateStep("apnsToken", { status: "running", elapsed: 0, message: "Contattando APNs..." });
      startStepTimer("apnsToken");

      try {
        const deviceTokenPromise = Notifications.getDevicePushTokenAsync();
        const deviceTokenResult = await withTimeout(
          deviceTokenPromise,
          TIMEOUTS.APNS_TOKEN,
          "APNs Device Token"
        );

        stopStepTimer();
        const apnsToken = deviceTokenResult.data as string;

        setTokenInfo((prev) => ({ ...prev, apnsDeviceToken: apnsToken, apnsDeviceTokenError: null }));
        updateStep("apnsToken", {
          status: "success",
          message: `Token ricevuto: ${apnsToken.substring(0, 16)}...`,
        });
        addLog(`APNs Token: ${apnsToken.substring(0, 20)}...`, "success");
      } catch (error) {
        stopStepTimer();
        const errorMsg = error instanceof Error ? error.message : String(error);
        const isTimeout = errorMsg.includes("TIMEOUT");
        let fullError = errorMsg;

        try {
          fullError = `${errorMsg}\n\nDettaglio: ${JSON.stringify(error, null, 2)}`;
        } catch {
          // ignore
        }

        setTokenInfo((prev) => ({ ...prev, apnsDeviceToken: null, apnsDeviceTokenError: fullError }));
        updateStep("apnsToken", {
          status: isTimeout ? "timeout" : "error",
          message: isTimeout ? `TIMEOUT dopo ${TIMEOUTS.APNS_TOKEN / 1000}s` : errorMsg,
        });
        addLog(`APNs Token ERRORE: ${errorMsg}`, "error");

        if (isTimeout) {
          addLog("CAUSA PROBABILE: Provisioning Profile non ha Push Notifications abilitato", "warning");
          addLog("SOLUZIONE: Rifare la build con --clear-cache", "warning");
        }
      }
    } else {
      addLog("=== STEP 2/3: APNs Token (saltato - non iOS) ===", "info");
      updateStep("apnsToken", { status: "success", message: "N/A (non iOS)" });
    }

    // Step 3: Get Expo Push Token
    addLog("=== STEP 3/3: Recupero Expo Push Token ===", "info");
    addLog(`Timeout impostato: ${TIMEOUTS.EXPO_TOKEN / 1000}s`, "info");
    updateStep("expoToken", { status: "running", elapsed: 0, message: "Contattando Expo..." });
    startStepTimer("expoToken");

    try {
      const tokenOptions: Notifications.ExpoPushTokenOptions = {};
      const currentProjectId = tokenInfo.projectId || getProjectId().id;

      if (currentProjectId) {
        tokenOptions.projectId = currentProjectId;
        addLog(`Usando projectId: ${currentProjectId}`, "info");
      } else {
        addLog("ATTENZIONE: Nessun projectId, il token potrebbe fallire", "warning");
      }

      const expoTokenPromise = Notifications.getExpoPushTokenAsync(tokenOptions);
      const expoTokenResult = await withTimeout(
        expoTokenPromise,
        TIMEOUTS.EXPO_TOKEN,
        "Expo Push Token"
      );

      stopStepTimer();
      const expoToken = expoTokenResult.data;

      setTokenInfo((prev) => ({ ...prev, expoPushToken: expoToken, expoPushTokenError: null }));
      updateStep("expoToken", {
        status: "success",
        message: `Token: ${expoToken.substring(0, 20)}...`,
      });
      addLog(`Expo Push Token: ${expoToken}`, "success");
    } catch (error) {
      stopStepTimer();
      const errorMsg = error instanceof Error ? error.message : String(error);
      const isTimeout = errorMsg.includes("TIMEOUT");
      let fullError = errorMsg;

      try {
        fullError = `${errorMsg}\n\nDettaglio: ${JSON.stringify(error, null, 2)}`;
      } catch {
        // ignore
      }

      setTokenInfo((prev) => ({ ...prev, expoPushToken: null, expoPushTokenError: fullError }));
      updateStep("expoToken", {
        status: isTimeout ? "timeout" : "error",
        message: isTimeout ? `TIMEOUT dopo ${TIMEOUTS.EXPO_TOKEN / 1000}s` : errorMsg,
      });
      addLog(`Expo Push Token ERRORE: ${errorMsg}`, "error");
    }

    addLog("=== DIAGNOSTICA COMPLETATA ===", "info");
    setFetchingTokens(false);
  };

  // Full diagnostic run
  const runFullDiagnostics = async () => {
    setIsRunningDiagnostics(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Reset all steps
    setDiagnosticSteps({
      projectId: initialStepState(TIMEOUTS.PROJECT_ID),
      permissionCheck: initialStepState(TIMEOUTS.PERMISSION_CHECK),
      permissionRequest: initialStepState(TIMEOUTS.PERMISSION_REQUEST),
      apnsToken: initialStepState(TIMEOUTS.APNS_TOKEN),
      expoToken: initialStepState(TIMEOUTS.EXPO_TOKEN),
    });
    setLogs([]);

    addLog("========================================", "info");
    addLog("   DIAGNOSTICA COMPLETA PUSH NOTIFICATIONS", "info");
    addLog("========================================", "info");
    addLog(`Piattaforma: ${Platform.OS}`, "info");
    addLog(`Device fisico: ${Device.isDevice}`, "info");
    addLog("", "info");

    // Step 1: Check permissions
    await checkPermissions();

    // Step 2: Request permissions if needed
    if (permissionInfo.existingStatus !== "granted") {
      await requestPermissions();
    } else {
      updateStep("permissionRequest", { status: "success", message: "Gia concessi" });
    }

    // Step 3-5: Fetch tokens
    await fetchTokens();

    setIsRunningDiagnostics(false);
  };

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await Clipboard.setStringAsync(text);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCopiedField(fieldName);
      addLog(`Copied ${fieldName} to clipboard`, "success");
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      addLog(`Failed to copy ${fieldName}`, "error");
    }
  };

  const copyAllDebugInfo = async () => {
    const debugInfo = `
=== PUSH DEBUG INFO ===
Date: ${new Date().toISOString()}

--- DEVICE INFO ---
Platform: ${Platform.OS}
isDevice: ${Device.isDevice}
Model: ${Device.modelName || "Unknown"}

--- PERMISSION STATUS ---
existingStatus: ${permissionInfo.existingStatus || "N/A"}
finalStatus: ${permissionInfo.finalStatus || "N/A"}
canAskAgain: ${permissionInfo.canAskAgain}

--- PROJECT ID ---
Value: ${tokenInfo.projectId || "NOT FOUND"}
Source: ${tokenInfo.projectIdSource || "N/A"}

--- EXPO PUSH TOKEN ---
Token: ${tokenInfo.expoPushToken || "N/A"}
Error: ${tokenInfo.expoPushTokenError || "None"}

--- APNs DEVICE TOKEN (iOS) ---
Token: ${tokenInfo.apnsDeviceToken || "N/A"}
Error: ${tokenInfo.apnsDeviceTokenError || "None"}

--- LOGS ---
${logs.map((l) => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.message}`).join("\n")}
`.trim();

    await copyToClipboard(debugInfo, "All Debug Info");
  };

  // Initial load
  useEffect(() => {
    if (hasLoadedOnce.current) return;
    hasLoadedOnce.current = true;

    const initLoad = async () => {
      addLog("Push Debug screen opened", "info");
      addLog(`Platform: ${Platform.OS}, isDevice: ${Device.isDevice}`, "info");

      const { id, source } = getProjectId();
      setTokenInfo((prev) => ({ ...prev, projectId: id, projectIdSource: source }));
      addLog(`Project ID detected: ${id || "NOT FOUND"} (${source})`, id ? "success" : "warning");

      await checkPermissions();
    };

    initLoad();
  }, [addLog, checkPermissions, getProjectId]);

  // Auto scroll logs
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [logs]);

  const getLogColor = (type: LogEntry["type"]) => {
    switch (type) {
      case "success":
        return "#10B981";
      case "error":
        return "#EF4444";
      case "warning":
        return "#F59E0B";
      default:
        return "#9CA3AF";
    }
  };

  const renderCopyButton = (text: string | null, fieldName: string) => {
    if (!text) return null;

    return (
      <Pressable
        onPress={() => copyToClipboard(text, fieldName)}
        className="flex-row items-center bg-gray-700 px-3 py-1.5 rounded-lg mt-2 self-start active:opacity-70"
      >
        <Ionicons
          name={copiedField === fieldName ? "checkmark" : "copy-outline"}
          size={14}
          color="#10B981"
        />
        <Text className="text-green-400 text-xs ml-1.5 font-medium">
          {copiedField === fieldName ? "Copied!" : "Copy"}
        </Text>
      </Pressable>
    );
  };

  // Helper to format elapsed time
  const formatElapsed = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const tenths = Math.floor((ms % 1000) / 100);
    return `${seconds}.${tenths}s`;
  };

  // Helper to get step status icon
  const getStepIcon = (status: StepStatus) => {
    switch (status) {
      case "idle":
        return { name: "ellipse-outline" as const, color: "#6B7280" };
      case "running":
        return { name: "sync" as const, color: "#3B82F6" };
      case "success":
        return { name: "checkmark-circle" as const, color: "#10B981" };
      case "error":
        return { name: "close-circle" as const, color: "#EF4444" };
      case "timeout":
        return { name: "time" as const, color: "#F59E0B" };
    }
  };

  // Helper to get status background color
  const getStepBgColor = (status: StepStatus) => {
    switch (status) {
      case "idle":
        return "bg-gray-800";
      case "running":
        return "bg-blue-900/40";
      case "success":
        return "bg-green-900/40";
      case "error":
        return "bg-red-900/40";
      case "timeout":
        return "bg-yellow-900/40";
    }
  };

  // Render single diagnostic step
  const renderDiagnosticStep = (
    stepKey: keyof DiagnosticSteps,
    stepNumber: number,
    title: string,
    description: string
  ) => {
    const step = diagnosticSteps[stepKey];
    const icon = getStepIcon(step.status);
    const bgColor = getStepBgColor(step.status);
    const progressPercent = step.status === "running" ? Math.min((step.elapsed / step.timeout) * 100, 100) : 0;

    return (
      <View key={stepKey} className={`${bgColor} rounded-xl p-4 mb-3 border ${step.status === "running" ? "border-blue-500" : "border-transparent"}`}>
        <View className="flex-row items-center">
          {/* Step Number & Icon */}
          <View className="w-10 h-10 rounded-full bg-gray-700 items-center justify-center mr-3">
            {step.status === "running" ? (
              <ActivityIndicator size="small" color="#3B82F6" />
            ) : (
              <Ionicons name={icon.name} size={24} color={icon.color} />
            )}
          </View>

          {/* Step Info */}
          <View className="flex-1">
            <View className="flex-row items-center">
              <Text className="text-white font-semibold text-sm">
                Step {stepNumber}: {title}
              </Text>
              {step.status === "running" && (
                <View className="ml-2 bg-blue-600 px-2 py-0.5 rounded">
                  <Text className="text-white text-xs font-mono">
                    {formatElapsed(step.elapsed)} / {formatElapsed(step.timeout)}
                  </Text>
                </View>
              )}
            </View>
            <Text className="text-gray-400 text-xs mt-0.5">{description}</Text>

            {/* Progress bar for running state */}
            {step.status === "running" && (
              <View className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
                <View
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </View>
            )}

            {/* Result message */}
            {step.message && step.status !== "idle" && step.status !== "running" && (
              <View className={`mt-2 p-2 rounded-lg ${
                step.status === "success" ? "bg-green-900/50" :
                step.status === "timeout" ? "bg-yellow-900/50" : "bg-red-900/50"
              }`}>
                <Text className={`text-xs font-mono ${
                  step.status === "success" ? "text-green-400" :
                  step.status === "timeout" ? "text-yellow-400" : "text-red-400"
                }`} selectable>
                  {step.message}
                </Text>
              </View>
            )}
          </View>

          {/* Timeout indicator */}
          <View className="ml-2 items-end">
            <Text className="text-gray-500 text-xs">Timeout</Text>
            <Text className="text-gray-400 text-xs font-mono">{step.timeout / 1000}s</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-900">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-gray-800">
        <Pressable
          onPress={() => navigation.goBack()}
          className="w-10 h-10 items-center justify-center rounded-full bg-gray-800 active:opacity-70"
        >
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </Pressable>
        <Text className="text-white text-lg font-bold ml-3 flex-1">
          Push Debug
        </Text>
        <View className="bg-yellow-500/20 px-2 py-1 rounded">
          <Text className="text-yellow-400 text-xs font-medium">DEBUG</Text>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        {/* DIAGNOSTIC STEPPER - Main Feature */}
        <View className="bg-gray-800 rounded-xl p-4 mb-4 border-2 border-blue-600">
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text className="text-white text-lg font-bold">Diagnostica Push</Text>
              <Text className="text-gray-400 text-xs">Esegui tutti i controlli con timeout</Text>
            </View>
            <Pressable
              onPress={runFullDiagnostics}
              disabled={isRunningDiagnostics}
              className={`px-4 py-2 rounded-xl flex-row items-center ${
                isRunningDiagnostics ? "bg-blue-600/50" : "bg-blue-600 active:bg-blue-700"
              }`}
            >
              {isRunningDiagnostics ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="play" size={16} color="white" />
              )}
              <Text className="text-white font-semibold ml-2 text-sm">
                {isRunningDiagnostics ? "In corso..." : "Avvia"}
              </Text>
            </Pressable>
          </View>

          {/* Steps */}
          {renderDiagnosticStep("permissionCheck", 1, "Verifica Permessi", "Controlla lo stato attuale dei permessi notifiche")}
          {renderDiagnosticStep("permissionRequest", 2, "Richiesta Permessi", "Richiede i permessi se non concessi")}
          {renderDiagnosticStep("projectId", 3, "Project ID", "Recupera l'ID progetto da EAS/Expo config")}
          {renderDiagnosticStep("apnsToken", 4, "APNs Token", "Richiede il token nativo da Apple Push Notification service")}
          {renderDiagnosticStep("expoToken", 5, "Expo Token", "Converte il token APNs in Expo Push Token")}

          {/* Timeout Legend */}
          <View className="mt-3 pt-3 border-t border-gray-700">
            <Text className="text-gray-500 text-xs font-medium mb-2">LEGENDA TIMEOUT</Text>
            <View className="flex-row flex-wrap">
              <View className="flex-row items-center mr-4 mb-1">
                <View className="w-2 h-2 rounded-full bg-gray-500 mr-1" />
                <Text className="text-gray-400 text-xs">In attesa</Text>
              </View>
              <View className="flex-row items-center mr-4 mb-1">
                <View className="w-2 h-2 rounded-full bg-blue-500 mr-1" />
                <Text className="text-gray-400 text-xs">In esecuzione</Text>
              </View>
              <View className="flex-row items-center mr-4 mb-1">
                <View className="w-2 h-2 rounded-full bg-green-500 mr-1" />
                <Text className="text-gray-400 text-xs">Successo</Text>
              </View>
              <View className="flex-row items-center mr-4 mb-1">
                <View className="w-2 h-2 rounded-full bg-red-500 mr-1" />
                <Text className="text-gray-400 text-xs">Errore</Text>
              </View>
              <View className="flex-row items-center mb-1">
                <View className="w-2 h-2 rounded-full bg-yellow-500 mr-1" />
                <Text className="text-gray-400 text-xs">Timeout</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 1. Device Info */}
        <View className="bg-gray-800 rounded-xl p-4 mb-4">
          <Text className="text-gray-400 text-xs font-medium mb-3">
            1. DEVICE INFO
          </Text>
          <View className="space-y-2">
            <View className="flex-row justify-between">
              <Text className="text-gray-400 text-sm">Platform:</Text>
              <Text className="text-white text-sm font-mono" selectable>
                {Platform.OS}
              </Text>
            </View>
            <View className="flex-row justify-between mt-1">
              <Text className="text-gray-400 text-sm">isDevice:</Text>
              <Text
                className={`text-sm font-mono ${
                  Device.isDevice ? "text-green-400" : "text-red-400"
                }`}
                selectable
              >
                {String(Device.isDevice)}
              </Text>
            </View>
            <View className="flex-row justify-between mt-1">
              <Text className="text-gray-400 text-sm">Model:</Text>
              <Text className="text-white text-sm font-mono" selectable>
                {Device.modelName || "Unknown"}
              </Text>
            </View>
          </View>
        </View>

        {/* 2. Permission Status */}
        <View className="bg-gray-800 rounded-xl p-4 mb-4">
          <Text className="text-gray-400 text-xs font-medium mb-3">
            2. PERMISSION STATUS
          </Text>
          <View className="space-y-2">
            <View className="flex-row justify-between">
              <Text className="text-gray-400 text-sm">existingStatus:</Text>
              <Text
                className={`text-sm font-mono ${
                  permissionInfo.existingStatus === "granted"
                    ? "text-green-400"
                    : permissionInfo.existingStatus
                    ? "text-yellow-400"
                    : "text-gray-500"
                }`}
                selectable
              >
                {permissionInfo.existingStatus || "N/A"}
              </Text>
            </View>
            <View className="flex-row justify-between mt-1">
              <Text className="text-gray-400 text-sm">finalStatus:</Text>
              <Text
                className={`text-sm font-mono ${
                  permissionInfo.finalStatus === "granted"
                    ? "text-green-400"
                    : permissionInfo.finalStatus
                    ? "text-yellow-400"
                    : "text-gray-500"
                }`}
                selectable
              >
                {permissionInfo.finalStatus || "N/A"}
              </Text>
            </View>
            <View className="flex-row justify-between mt-1">
              <Text className="text-gray-400 text-sm">canAskAgain:</Text>
              <Text className="text-white text-sm font-mono" selectable>
                {permissionInfo.canAskAgain !== null
                  ? String(permissionInfo.canAskAgain)
                  : "N/A"}
              </Text>
            </View>
          </View>

          {permissionInfo.existingStatus !== "granted" && (
            <View className="mt-3 bg-yellow-900/30 border border-yellow-700 rounded-lg p-3">
              <Text className="text-yellow-400 text-xs">
                Permessi non concessi. Premi il bottone Avvia Diagnostica sopra.
              </Text>
            </View>
          )}
        </View>

        {/* 3. Expo Push Token */}
        <View className="bg-gray-800 rounded-xl p-4 mb-4">
          <Text className="text-gray-400 text-xs font-medium mb-3">
            3. EXPO PUSH TOKEN
          </Text>

          {/* Project ID */}
          <View className="mb-3">
            <Text className="text-gray-500 text-xs mb-1">Project ID:</Text>
            <View className="bg-gray-900 rounded-lg p-3">
              <Text
                className={`text-xs font-mono ${
                  tokenInfo.projectId ? "text-green-400" : "text-red-400"
                }`}
                selectable
              >
                {tokenInfo.projectId || "NOT FOUND"}
              </Text>
              <Text className="text-gray-500 text-xs mt-1">
                Source: {tokenInfo.projectIdSource || "N/A"}
              </Text>
            </View>
          </View>

          {/* Token */}
          <View>
            <Text className="text-gray-500 text-xs mb-1">Token:</Text>
            <View className="bg-gray-900 rounded-lg p-3">
              {tokenInfo.expoPushToken ? (
                <>
                  <Text className="text-green-400 text-xs font-mono" selectable>
                    {tokenInfo.expoPushToken}
                  </Text>
                  {renderCopyButton(tokenInfo.expoPushToken, "Expo Push Token")}
                </>
              ) : tokenInfo.expoPushTokenError ? (
                <Text className="text-red-400 text-xs font-mono" selectable>
                  ERROR: {tokenInfo.expoPushTokenError}
                </Text>
              ) : (
                <Text className="text-gray-500 text-xs">
                  Premi Fetch Tokens per ottenere il token
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* 4. APNs Device Token (iOS only) */}
        <View className="bg-gray-800 rounded-xl p-4 mb-4">
          <Text className="text-gray-400 text-xs font-medium mb-3">
            4. APNs DEVICE TOKEN (iOS only)
          </Text>

          {Platform.OS !== "ios" ? (
            <View className="bg-gray-900 rounded-lg p-3">
              <Text className="text-gray-500 text-xs">
                Non applicabile (piattaforma: {Platform.OS})
              </Text>
            </View>
          ) : (
            <View className="bg-gray-900 rounded-lg p-3">
              {tokenInfo.apnsDeviceToken ? (
                <>
                  <Text className="text-green-400 text-xs font-mono" selectable>
                    {tokenInfo.apnsDeviceToken}
                  </Text>
                  {renderCopyButton(tokenInfo.apnsDeviceToken, "APNs Token")}
                </>
              ) : tokenInfo.apnsDeviceTokenError ? (
                <Text className="text-red-400 text-xs font-mono" selectable>
                  ERROR: {tokenInfo.apnsDeviceTokenError}
                </Text>
              ) : (
                <Text className="text-gray-500 text-xs">
                  Premi Fetch Tokens per ottenere il token
                </Text>
              )}
            </View>
          )}
        </View>

        {/* 5. Log Area */}
        <View className="bg-gray-800 rounded-xl p-4 mb-4">
          <Text className="text-gray-400 text-xs font-medium mb-3">
            5. LOG AREA
          </Text>
          <ScrollView
            ref={scrollViewRef}
            className="bg-gray-900 rounded-lg p-3"
            style={{ maxHeight: 200 }}
            nestedScrollEnabled
          >
            {logs.length === 0 ? (
              <Text className="text-gray-500 text-xs">Nessun log</Text>
            ) : (
              logs.map((log, index) => (
                <View key={index} className="flex-row mb-1">
                  <Text className="text-gray-600 text-xs font-mono">
                    [{log.timestamp}]{" "}
                  </Text>
                  <Text
                    className="text-xs font-mono flex-1"
                    style={{ color: getLogColor(log.type) }}
                    selectable
                  >
                    {log.message}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
        </View>

        {/* 6. Buttons */}
        <View className="bg-gray-800 rounded-xl p-4 mb-4">
          <Text className="text-gray-400 text-xs font-medium mb-3">
            6. ACTIONS
          </Text>

          <View className="space-y-3">
            {/* Request Permissions */}
            <Pressable
              onPress={requestPermissions}
              disabled={loading}
              className={`py-3 px-4 rounded-xl flex-row items-center justify-center ${
                loading ? "bg-blue-600/50" : "bg-blue-600 active:bg-blue-700"
              }`}
            >
              {loading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Ionicons name="shield-checkmark" size={18} color="white" />
              )}
              <Text className="text-white font-semibold ml-2">
                {loading ? "Richiedendo..." : "Richiedi Permessi"}
              </Text>
            </Pressable>

            {/* Fetch Tokens */}
            <Pressable
              onPress={fetchTokens}
              disabled={fetchingTokens}
              className={`py-3 px-4 rounded-xl flex-row items-center justify-center mt-3 ${
                fetchingTokens ? "bg-green-600/50" : "bg-green-600 active:bg-green-700"
              }`}
            >
              {fetchingTokens ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Ionicons name="download" size={18} color="white" />
              )}
              <Text className="text-white font-semibold ml-2">
                {fetchingTokens ? "Recuperando..." : "Recupera Token"}
              </Text>
            </Pressable>

            {/* Copy buttons row */}
            <View className="flex-row gap-2 mt-3">
              <Pressable
                onPress={() =>
                  tokenInfo.expoPushToken &&
                  copyToClipboard(tokenInfo.expoPushToken, "Expo Push Token")
                }
                disabled={!tokenInfo.expoPushToken}
                className={`flex-1 py-2.5 px-3 rounded-xl flex-row items-center justify-center ${
                  tokenInfo.expoPushToken
                    ? "bg-purple-600 active:bg-purple-700"
                    : "bg-gray-700"
                }`}
              >
                <Ionicons
                  name="copy"
                  size={14}
                  color={tokenInfo.expoPushToken ? "white" : "#6B7280"}
                />
                <Text
                  className={`text-xs font-medium ml-1.5 ${
                    tokenInfo.expoPushToken ? "text-white" : "text-gray-500"
                  }`}
                >
                  Copia Expo Token
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  tokenInfo.apnsDeviceToken &&
                  copyToClipboard(tokenInfo.apnsDeviceToken, "APNs Token")
                }
                disabled={!tokenInfo.apnsDeviceToken}
                className={`flex-1 py-2.5 px-3 rounded-xl flex-row items-center justify-center ${
                  tokenInfo.apnsDeviceToken
                    ? "bg-orange-600 active:bg-orange-700"
                    : "bg-gray-700"
                }`}
              >
                <Ionicons
                  name="copy"
                  size={14}
                  color={tokenInfo.apnsDeviceToken ? "white" : "#6B7280"}
                />
                <Text
                  className={`text-xs font-medium ml-1.5 ${
                    tokenInfo.apnsDeviceToken ? "text-white" : "text-gray-500"
                  }`}
                >
                  Copia APNs Token
                </Text>
              </Pressable>
            </View>

            {/* Copia Tutto */}
            <Pressable
              onPress={copyAllDebugInfo}
              className="py-3 px-4 rounded-xl flex-row items-center justify-center bg-gray-700 active:bg-gray-600 mt-3"
            >
              <Ionicons name="clipboard" size={18} color="white" />
              <Text className="text-white font-semibold ml-2">
                Copia Tutto
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Troubleshooting */}
        <View className="bg-gray-800 rounded-xl p-4">
          <Text className="text-gray-400 text-xs font-medium mb-2">
            RISOLUZIONE PROBLEMI
          </Text>

          <View className="space-y-3">
            <View>
              <Text className="text-yellow-400 text-xs font-medium">
                Se APNs Token va in timeout o fallisce:
              </Text>
              <Text className="text-gray-400 text-xs mt-1">
                {"\u2022 La build deve essere production (non development/preview)\n"}
                {"\u2022 eas.json deve avere distribution: store\n"}
                {"\u2022 aps-environment deve essere production\n"}
                {"\u2022 APNs Push Key deve essere configurata su Expo Dashboard\n"}
                {"\u2022 Bundle ID deve corrispondere a Apple Developer Portal"}
              </Text>
            </View>

            <View className="mt-3">
              <Text className="text-yellow-400 text-xs font-medium">
                Se Expo Token fallisce:
              </Text>
              <Text className="text-gray-400 text-xs mt-1">
                {"\u2022 Verifica che projectId corrisponda a Expo Dashboard\n"}
                {"\u2022 Controlla la connessione internet\n"}
                {"\u2022 Prova a rifare la build"}
              </Text>
            </View>

            <View className="mt-3">
              <Text className="text-yellow-400 text-xs font-medium">
                Se Project ID NON TROVATO:
              </Text>
              <Text className="text-gray-400 text-xs mt-1">
                {"\u2022 Esegui eas build:configure in locale\n"}
                {"\u2022 Verifica che app.json abbia extra.eas.projectId\n"}
                {"\u2022 Rifai la build dopo la configurazione"}
              </Text>
            </View>
          </View>
        </View>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
