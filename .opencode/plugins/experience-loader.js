import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

let pluginLoaded = false;

function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

function findRelevantExperiences(message, experienceData, profile) {
  if (!experienceData?.experiences || !profile?.project_preferences?.experience_recall) {
    return [];
  }
  
  const msg = message.toLowerCase();
  const triggerKeywords = ['请', '能不能', '帮我', '如何', '怎么', '为什么', '是什么', '教我', '分享', '传授', '你说', '还是', '去还是', '呢', '?'];
  const isRecallTriggered = triggerKeywords.some(k => msg.includes(k));
  
  if (!isRecallTriggered) {
    return [];
  }
  
  return experienceData.experiences
    .filter((e) => e.success_rate > 0 || e.contexts?.includes('error_experience'))
    .slice(0, 5);
}

function compressConversation(messages) {
  const summary = {
    turns: [],
    toolCalls: 0,
    lastUserQuery: '',
    lastAssistantReply: ''
  };
  
  for (const msgInfo of messages) {
    const msg = msgInfo.info;
    if (msg.role === 'user') {
      const content = msg.content?.[0]?.text || '';
      summary.turns.push({ role: 'user', content: content.substring(0, 300) });
      summary.lastUserQuery = content.substring(0, 200);
    } else if (msg.role === 'assistant') {
      const content = msg.content?.[0]?.text || '';
      summary.turns.push({ role: 'assistant', content: content.substring(0, 500) });
      summary.lastAssistantReply = content.substring(0, 300);
    } else if (msg.role === 'tool') {
      summary.toolCalls++;
    }
  }
  
  return summary;
}

function generateTopicSummary(messages) {
  const userQueries = [];
  const assistantReplies = [];
  let toolCount = 0;
  
  for (const msgInfo of messages) {
    const msg = msgInfo.info;
    if (msg.role === 'user') {
      const content = msg.content?.[0]?.text || '';
      if (content) userQueries.push(content.substring(0, 200));
    } else if (msg.role === 'assistant') {
      const content = msg.content?.[0]?.text || '';
      if (content) assistantReplies.push(content.substring(0, 300));
    } else if (msg.role === 'tool') {
      toolCount++;
    }
  }
  
  const lastQuery = userQueries[userQueries.length - 1] || '';
  const lastReply = assistantReplies[assistantReplies.length - 1] || '';
  
  return {
    userQueries,
    assistantReplies,
    toolCount,
    lastQuery,
    lastReply,
    totalTurns: messages.length
  };
}

function analyzeSessionForExperience(messages, reason) {
  const errors = [];
  let finalResponse = null;
  let toolExecutions = [];
  let userQueries = [];
  
  for (const msgInfo of messages) {
    const msg = msgInfo.info;
    if (msg.role === 'user') {
      const content = msg.content?.[0]?.text || '';
      userQueries.push(content.substring(0, 200));
      if (content.includes('你这样做不对') || content.includes('我说的是') || content.includes('不是') || content.includes('错')) {
        errors.push({ type: 'user_correction', content });
      }
    } else if (msg.role === 'assistant') {
      const content = msg.content?.[0]?.text || '';
      if (content.includes('抱歉') || content.includes('我错了') || content.includes('理解有误') || content.includes('重新')) {
        errors.push({ type: 'model_self_correction', content });
      }
      if (content.includes('不行') || content.includes('行不通') || content.includes('放弃') || content.includes('改用')) {
        errors.push({ type: 'model_abandon_plan', content });
      }
      finalResponse = content;
    } else if (msg.role === 'tool') {
      toolExecutions.push(msg);
    }
  }
  
  if (errors.length === 0 && finalResponse) {
    return {
      type: 'success',
      reason,
      problem_background: userQueries[0] || 'User query',
      response: finalResponse.substring(0, 500),
      toolCount: toolExecutions.length,
      messageCount: messages.length
    };
  }
  
  if (errors.length > 0) {
    return {
      type: 'error',
      reason,
      problem_background: userQueries[0] || 'User query',
      errors,
      toolCount: toolExecutions.length,
      messageCount: messages.length
    };
  }
  
  if (messages.length > 2 && !finalResponse) {
    return {
      type: 'incomplete',
      reason,
      problem_background: userQueries[0] || 'User query',
      toolCount: toolExecutions.length,
      messageCount: messages.length,
      partial_lessons: [
        `对话未完成即中断（原因：${reason}）`,
        `已进行 ${messages.length} 轮交互`,
        `调用工具 ${toolExecutions.length} 次`
      ]
    };
  }
  
  return null;
}

export default async function experiencePlugin(input) {
  if (pluginLoaded) {
    return {};
  }
  pluginLoaded = true;
  
  const projectDir = input.directory;
  const experienceDataDir = join(projectDir, 'experience-data');
  
  const userProfilePath = join(experienceDataDir, 'user-profile.json');
  const experienceDataPath = join(experienceDataDir, 'experience-data.json');
  const tempTopicPath = join(experienceDataDir, 'temp-topic.json');
  
  let userProfile = null;
  let experienceData = null;
  let tempTopic = null;
  let sessionMessages = [];
  
  const loadData = () => {
    if (existsSync(userProfilePath)) {
      try {
        userProfile = JSON.parse(readFileSync(userProfilePath, 'utf-8'));
      } catch (e) {
        console.error('[Experience] Failed to load user-profile.json:', e);
      }
    }
    
    if (existsSync(experienceDataPath)) {
      try {
        experienceData = JSON.parse(readFileSync(experienceDataPath, 'utf-8'));
      } catch (e) {
        console.error('[Experience] Failed to load experience-data.json:', e);
      }
    }
    
    if (existsSync(tempTopicPath)) {
      try {
        tempTopic = JSON.parse(readFileSync(tempTopicPath, 'utf-8'));
      } catch (e) {
        console.error('[Experience] Failed to load temp-topic.json:', e);
      }
    }
  };
  
  const saveTempTopic = () => {
    if (sessionMessages.length < 2) return;
    
    const summary = generateTopicSummary(sessionMessages);
    const topic = {
      id: generateId(),
      fullConversation: sessionMessages.map(m => ({
        role: m.info.role,
        content: m.info.content?.[0]?.text || ''
      })),
      summary: summary,
      created_at: new Date().toISOString(),
      last_updated: new Date().toISOString(),
      messageCount: sessionMessages.length,
      waitingForContinue: true,
      isContinuing: false
    };
    
    try {
      if (!existsSync(experienceDataDir)) {
        mkdirSync(experienceDataDir, { recursive: true });
      }
      writeFileSync(tempTopicPath, JSON.stringify(topic, null, 2), 'utf-8');
      console.log('[Experience] Temp topic saved, turns:', topic.messageCount);
    } catch (e) {
      console.error('[Experience] Failed to save temp topic:', e);
    }
  };
  
  const clearTempTopic = () => {
    try {
      if (existsSync(tempTopicPath)) {
        writeFileSync(tempTopicPath, JSON.stringify(null, null, 2), 'utf-8');
        console.log('[Experience] Temp topic cleared');
      }
    } catch (e) {
      console.error('[Experience] Failed to clear temp topic:', e);
    }
  };
  
  const saveExperience = (newExp) => {
    if (!experienceData) {
      experienceData = { experiences: [], config: { enabled: true, autoCapture: true, autoRecall: true } };
    }
    
    experienceData.experiences.push(newExp);
    
    try {
      writeFileSync(experienceDataPath, JSON.stringify(experienceData, null, 2), 'utf-8');
      console.log(`[Experience] Saved (${newExp.contexts?.[0] || 'unknown'}):`, newExp.id);
    } catch (e) {
      console.error('[Experience] Failed to save:', e);
    }
  };
  
  const saveIncompleteExperience = (analysis) => {
    if (!experienceData) return;
    
    const newExp = {
      id: generateId(),
      problem_background: analysis.problem_background,
      core_problem: `对话中断（${analysis.reason}）- 共 ${analysis.messageCount} 轮交互`,
      failed_solutions: [],
      successful_solution: null,
      lessons: analysis.partial_lessons || [],
      contexts: ['incomplete_session', 'experience_capture'],
      completion_status: 'incomplete',
      message_count: analysis.messageCount,
      tool_count: analysis.toolCount,
      interrupt_reason: analysis.reason,
      success_rate: 0.5,
      usage_count: 1,
      last_used: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    
    saveExperience(newExp);
  };
  
  const tryCaptureExperience = (reason) => {
    if (sessionMessages.length === 0) return;
    
    const analysis = analyzeSessionForExperience(sessionMessages, reason);
    
    if (analysis?.type === 'error' && analysis.errors?.length > 0) {
      for (const err of analysis.errors) {
        const newExp = {
          id: generateId(),
          problem_background: analysis.problem_background,
          core_problem: `${err.type}: ${err.content.substring(0, 100)}`,
          failed_solutions: [{
            approach: err.content.substring(0, 200),
            result: 'fail',
            reason: `Error type: ${err.type}`
          }],
          successful_solution: null,
          lessons: [
            `错误类型：${err.type}`,
            `原方案：${err.content.substring(0, 200)}`,
            '该方案已被证明不可行，需避免重复尝试'
          ],
          contexts: [err.type, 'error_experience'],
          completion_status: 'error',
          message_count: analysis.messageCount,
          tool_count: analysis.toolCount,
          success_rate: 0,
          usage_count: 1,
          last_used: new Date().toISOString(),
          created_at: new Date().toISOString()
        };
        saveExperience(newExp);
      }
    } else if (analysis?.type === 'success') {
      console.log(`[Experience] Session completed successfully (${reason}), tools: ${analysis.toolCount}, messages: ${analysis.messageCount}`);
      clearTempTopic();
    } else if (analysis?.type === 'incomplete') {
      console.log(`[Experience] Session incomplete (${reason}), saving partial experience...`);
      saveIncompleteExperience(analysis);
    }
    
    if (reason !== 'compacted') {
      sessionMessages = [];
    }
  };
  
  loadData();
  
  return {
    'experimental.chat.system.transform': async (ctx, output) => {
      loadData();
      
      let systemParts = [];
      
      if (userProfile) {
        const preferences = userProfile.value?.project_preferences || {};
        const profile = {
          name: userProfile.value?.name,
          nationality: userProfile.value?.nationality,
          location: userProfile.value?.location,
          priorities: userProfile.value?.priorities || [],
          reply_style: userProfile.value?.reply_style_preference || {},
          personal_taboos: userProfile.value?.personal_taboos || [],
        };
        
        const userPrefPrompt = `
[Project Preferences - Auto Loaded]
User: ${profile.name} (${profile.nationality}, ${profile.location})
Priorities: ${profile.priorities.join(', ')}
Reply Style: brevity=${profile.reply_style.brevity}, tone=${profile.reply_style.tone}, emoji=${profile.reply_style.emoji}, intro_outro=${profile.reply_style.intro_outro}
Taboos: ${profile.personal_taboos.join(', ')}

Project Rules:
${Object.entries(preferences).map(([key, val]) => `- ${key}: ${val.rule}`).join('\n')}

[Error Experience - Auto Loaded]
${experienceData?.experiences?.filter((e) => e.contexts?.includes('error_experience')).map((e) => `- ${e.id}: ${e.lessons?.[0] || ''}`).join('\n') || 'None'}
`;
        systemParts.push(userPrefPrompt);
      }
      
      if (tempTopic && tempTopic.summary && tempTopic.summary.totalTurns > 0) {
        const summary = tempTopic.summary;
        const topicPrompt = `
[Unfinished Topic Detected]
There is an unfinished conversation from a previous session:
- Session ended: ${tempTopic.last_updated}
- Total exchanges: ${summary.totalTurns} turns
- Tool calls: ${summary.toolCount}

Last conversation:
User asked: "${summary.lastQuery}"
You replied: "${summary.lastReply.substring(0, 150)}..."

ACTION REQUIRED: Before continuing, you MUST ask the user if they want to continue from where they left off.
- If user says YES (e.g., "好", "继续", "是", "对的", "是的", "好", "接", "yes", "yeah", "yep", etc.): Say "好的，让我们继续之前的话题" and wait for their input to continue naturally.
- If user says NO (e.g., "不", "不要", "算了", "不用", "no", "nope", "算了", "重新", "新", etc.): Say "好的，我们重新开始" and clear the topic.
- If user starts with a NEW unrelated topic: Treat as "NO" and clear the topic.

IMPORTANT: Do NOT assume. Ask the user explicitly first!
`;
        systemParts.push(topicPrompt);
      }
      
      if (systemParts.length > 0) {
        output.system.push(...systemParts);
      }
    },
    'chat.message': async (ctx, output) => {
      const userMessage = output.message.content?.[0]?.text || '';
      sessionMessages.push({ info: { role: 'user', content: output.message.content }, parts: output.parts });
      
      const msg = userMessage.toLowerCase();
      const continueKeywords = ['好', '继续', '是', '对的', '是的', '好', '接', 'yes', 'yeah', 'yep', 'y', '好嘞', '行', '可以的', '要的', '要继续'];
      const stopKeywords = ['不', '不要', '算了', '不用', 'no', 'nope', '重新', '新', '不要了', '不用了', '换个', '换一个'];
      
      const isContinue = continueKeywords.some(k => msg.includes(k));
      const isStop = stopKeywords.some(k => msg.includes(k));
      
      if (tempTopic && tempTopic.fullConversation && tempTopic.fullConversation.length > 0) {
        const waitingForContinue = tempTopic.waitingForContinue;
        
        if (waitingForContinue) {
          if (isContinue) {
            const historyText = tempTopic.fullConversation
              .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.substring(0, 400)}`)
              .join('\n\n');
            
            output.parts.push({
              type: 'text',
              text: `\n[Continuing previous conversation - full history loaded]\n\n${historyText}\n\n--- Above is the previous conversation, continue naturally ---`
            });
            
            tempTopic.waitingForContinue = false;
            tempTopic.isContinuing = true;
            try {
              writeFileSync(tempTopicPath, JSON.stringify(tempTopic, null, 2), 'utf-8');
            } catch (e) {}
            
          } else if (isStop || msg.length > 10) {
            clearTempTopic();
          }
          return;
        }
        
        if (tempTopic.isContinuing) {
          return;
        }
      }
      
      const relevant = findRelevantExperiences(userMessage, experienceData, userProfile);
      if (relevant.length > 0) {
        const recallText = `\n[Auto Recall] Relevant experiences:\n${relevant.map((e) => `- ${e.id}: ${e.core_problem || e.lessons?.[0] || ''}`).join('\n')}\n`;
        output.parts.push({ type: 'text', text: recallText });
      }
    },
    'experimental.chat.messages.transform': async (ctx, output) => {
      sessionMessages = output.messages.map(m => ({ info: m.info, parts: m.parts }));
    },
    'tool.execute.after': async (ctx, output) => {
      sessionMessages.push({
        info: { role: 'tool', content: [{ type: 'text', text: output.output }] },
        parts: [{ type: 'text', text: output.output }]
      });
    },
    'experimental.text.complete': async (ctx, output) => {
      sessionMessages.push({
        info: { role: 'assistant', content: [{ type: 'text', text: output.text }], id: ctx.messageID },
        parts: [{ type: 'text', text: output.text }]
      });
      
      saveTempTopic();
    },
    'event': async (input) => {
      const eventType = input.event?.type;
      
      if (eventType === 'session.compacted') {
        console.log('[Experience] Session compacted, capturing intermediate experience...');
        tryCaptureExperience('compacted');
      }
      else if (eventType === 'session.idle') {
        tryCaptureExperience('idle');
      }
      else if (eventType === 'session.deleted') {
        tryCaptureExperience('deleted');
      }
      else if (eventType === 'session.error') {
        console.log('[Experience] Session error, capturing error experience...');
        tryCaptureExperience('error');
      }
    }
  };
}
