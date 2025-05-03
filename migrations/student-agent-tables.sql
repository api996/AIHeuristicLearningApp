-- 学生智能体预设配置表
CREATE TABLE IF NOT EXISTS student_agent_presets (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  subject VARCHAR(100) NOT NULL,
  grade_level VARCHAR(50) NOT NULL,
  cognitive_level VARCHAR(20) DEFAULT 'medium',
  motivation_level VARCHAR(20) DEFAULT 'medium',
  learning_style VARCHAR(20) DEFAULT 'visual',
  personality_trait VARCHAR(20) DEFAULT 'balanced',
  system_prompt TEXT NOT NULL,
  kwlq_template JSONB DEFAULT '{"K": [], "W": [], "L": [], "Q": []}',
  challenge_areas TEXT,
  common_misconceptions JSONB,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

-- 学生智能体会话表
CREATE TABLE IF NOT EXISTS student_agent_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  preset_id INTEGER NOT NULL REFERENCES student_agent_presets(id),
  name VARCHAR(255) NOT NULL,
  learning_topic VARCHAR(255) NOT NULL,
  current_state JSONB NOT NULL,
  motivation_level INTEGER DEFAULT 60,
  confusion_level INTEGER DEFAULT 30,
  completed_objectives JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_interaction_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

-- 学生智能体消息表
CREATE TABLE IF NOT EXISTS student_agent_messages (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES student_agent_sessions(id),
  content TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'tutor', 'system')),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  state_snapshot JSONB,
  kwlq_update_type VARCHAR(10) DEFAULT 'none' CHECK (kwlq_update_type IN ('K', 'W', 'L', 'Q', 'none')),
  kwlq_update_content TEXT
);

-- 学生智能体评估表
CREATE TABLE IF NOT EXISTS student_agent_evaluations (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES student_agent_sessions(id),
  evaluator_id INTEGER NOT NULL REFERENCES users(id),
  realism_score INTEGER NOT NULL CHECK (realism_score >= 1 AND realism_score <= 10),
  learning_trajectory_score INTEGER NOT NULL CHECK (learning_trajectory_score >= 1 AND learning_trajectory_score <= 10),
  kwlq_completion_rate INTEGER NOT NULL CHECK (kwlq_completion_rate >= 0 AND kwlq_completion_rate <= 100),
  language_diversity_score INTEGER CHECK (language_diversity_score IS NULL OR (language_diversity_score >= 1 AND language_diversity_score <= 10)),
  comments TEXT,
  evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_student_agent_presets_subject ON student_agent_presets(subject);
CREATE INDEX IF NOT EXISTS idx_student_agent_sessions_user_id ON student_agent_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_student_agent_sessions_preset_id ON student_agent_sessions(preset_id);
CREATE INDEX IF NOT EXISTS idx_student_agent_messages_session_id ON student_agent_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_student_agent_messages_role ON student_agent_messages(role);
CREATE INDEX IF NOT EXISTS idx_student_agent_evaluations_session_id ON student_agent_evaluations(session_id);