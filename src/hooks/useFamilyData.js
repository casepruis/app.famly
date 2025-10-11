import { useState, useEffect, useCallback } from "react";
import { User, Family, FamilyMember, ScheduleEvent, Task } from "@/api/entities";

/**
 * Centralized data loader for Famly app: user, family, members, events, tasks.
 * Usage: const { user, family, members, events, tasks, isLoading, error, reload } = useFamilyData();
 */
// useFamilyData has moved to FamilyDataContext.jsx for global caching and websocket updates.
// Please use: import { useFamilyData } from "@/hooks/FamilyDataContext";
