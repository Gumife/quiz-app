import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuestionBank } from '../hooks/useQuestionBank';
import { useUploadReducer } from '../hooks/useUploadReducer';
import type { UploadedFile } from '../hooks/useUploadReducer';
import { processText } from '../utils/fileParser';
import type { Question, QuestionType } from '../types';
import { isQuestionType, QUESTION_TYPE_SHORT_LABELS } from '../types';
import styles from './Upload.module.css';

const Upload: React.FC = () => {
  const navigate = useNavigate();
  const { banks, addBank, removeBank, setActiveBank, processUploadedFile } = useQuestionBank();
  const {
    state,
    addFiles, removeFile, setProcessing, updateFileStatus,
    setPreview, clearPreview, startEdit, updateEdit, saveEdit,
    cancelEdit, deleteQuestion, addQuestion, togglePaste,
    setPasteText, setPasteName,
  } = useUploadReducer();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { files, isProcessing, previewQuestions, previewBankName, previewSource, editingId, editField, showPaste, pasteText, pasteName } = state;

  const getMimeType = (ext: string): string => {
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.doc': 'application/msword',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  };

  const supportedFormats = [
    { ext: '.docx', name: 'Word文档', icon: '📝' },
    { ext: '.pdf', name: 'PDF文档', icon: '📄' },
    { ext: '.xlsx', name: 'Excel表格', icon: '📈' },
    { ext: '.txt', name: '文本文件', icon: '📄' },
    { ext: '.md', name: 'Markdown', icon: '📝' },
    { ext: '.json', name: 'JSON数据', icon: '📊' },
  ];

  const buildUploadedFiles = (fileList: FileList | File[]): UploadedFile[] => {
    const result: UploadedFile[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      const isSupported = supportedFormats.some(f => f.ext === ext);
      result.push({
        id: Date.now().toString() + i,
        file,
        name: file.name,
        type: file.type || ext,
        size: file.size,
        status: isSupported ? 'pending' : 'error',
        error: isSupported ? undefined : `不支持的文件格式: ${ext}`
      });
    }
    return result;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;
    addFiles(buildUploadedFiles(selectedFiles));
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFiles = e.dataTransfer.files;
    if (!droppedFiles) return;
    addFiles(buildUploadedFiles(droppedFiles));
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleElectronFileSelect = async () => {
    if (window.electronAPI) {
      try {
        const result = await window.electronAPI.showOpenDialog({
          filters: [
            { name: '文档', extensions: ['pdf', 'docx', 'doc', 'pptx', 'xlsx', 'txt', 'md', 'json'] },
            { name: '图片', extensions: ['png', 'jpg', 'jpeg'] },
          ],
          properties: ['openFile', 'multiSelections'],
        });

        if (result.filePaths && result.filePaths.length > 0) {
          const newFiles: UploadedFile[] = [];
          for (let i = 0; i < result.filePaths.length; i++) {
            const filePath = result.filePaths[i];
            const fileName = filePath.split(/[\\/]/).pop() || '';
            const ext = '.' + fileName.split('.').pop()?.toLowerCase();
            const isSupported = supportedFormats.some(f => f.ext === ext);

            if (isSupported && window.electronAPI.readFile) {
              try {
                const fileBuffer = await window.electronAPI.readFile(filePath);
                const blob = new Blob([fileBuffer], { type: getMimeType(ext) });
                const file = new File([blob], fileName);
                
                newFiles.push({
                  id: Date.now().toString() + i,
                  file,
                  name: fileName,
                  type: ext,
                  size: file.size,
                  status: 'pending',
                  error: undefined,
                });
              } catch (readErr) {
                console.error('Failed to read file:', readErr);
                newFiles.push({
                  id: Date.now().toString() + i,
                  file: new File([''], fileName),
                  name: fileName,
                  type: ext,
                  size: 0,
                  status: 'error',
                  error: '读取文件失败',
                });
              }
            } else {
              newFiles.push({
                id: Date.now().toString() + i,
                file: new File([''], fileName),
                name: fileName,
                type: ext,
                size: 0,
                status: isSupported ? 'pending' : 'error',
                error: isSupported ? undefined : `不支持的文件格式: ${ext}`,
              });
            }
          }
          addFiles(newFiles);
        }
      } catch (err) {
        console.error('Electron file dialog error:', err);
      }
    } else if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const processFiles = async () => {
    const pendingFiles = files.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    setProcessing(true);
    const allQuestions: Question[] = [];
    let bankName = '';
    const source = '';

    for (const uploadedFile of pendingFiles) {
      updateFileStatus(uploadedFile.id, 'processing');

      try {
        let name = '';
        let questions: Question[] = [];
        let conversionError = '';
        try {
          const result = await processUploadedFile(uploadedFile.file);
          name = result.name;
          questions = result.questions;
        } catch (e) {
          conversionError = e instanceof Error ? e.message : String(e);
        }

        if (questions.length === 0) {
          const ext = uploadedFile.file.name.split('.').pop()?.toLowerCase();
          const isElectron = !!window.electronAPI?.convertFile;
          const errMsg = conversionError || (isElectron ? '文档转换失败' : '文档格式需要桌面版');
          if (['png', 'jpg', 'jpeg'].includes(ext || '')) {
            updateFileStatus(uploadedFile.id, 'error', isElectron ? (conversionError || '图片识别失败') : '图片格式需要桌面版');
          } else if (['pdf', 'docx', 'doc', 'pptx', 'xlsx'].includes(ext || '')) {
            updateFileStatus(uploadedFile.id, 'error', errMsg);
          } else {
            updateFileStatus(uploadedFile.id, 'error', '未能识别题目内容，请检查文件格式是否包含题号(如 1. xxx)和答案');
          }
        } else {
          allQuestions.push(...questions);
          bankName = name;
          updateFileStatus(uploadedFile.id, 'completed', undefined, questions.length);
        }
      } catch {
        updateFileStatus(uploadedFile.id, 'error', '处理失败');
      }
    }

    setProcessing(false);

    if (allQuestions.length > 0) {
      setPreview(allQuestions, bankName, source);
    }
  };

  const handleUseBank = (bankId: string) => {
    setActiveBank(bankId);
    navigate('/');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (fileName: string): string => {
    const ext = '.' + fileName.split('.').pop()?.toLowerCase();
    const format = supportedFormats.find(f => f.ext === ext);
    return format?.icon || '📄';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <span className={styles.statusPending}>待处理</span>;
      case 'processing': return <span className={styles.statusProcessing}>处理中...</span>;
      case 'completed': return <span className={styles.statusCompleted}>已完成</span>;
      case 'error': return <span className={styles.statusError}>错误</span>;
      default: return null;
    }
  };

  const formatTypeBreakdown = (stats: Record<QuestionType, number>) => {
    return Object.entries(stats)
      .filter(([, count]) => count > 0)
      .map(([type, count]) => `${QUESTION_TYPE_SHORT_LABELS[type as QuestionType]}${count}`)
      .join(' · ');
  };

  const handleAddQuestion = () => {
    const newId = Math.max(0, ...previewQuestions.map(q => q.id)) + 1;
    addQuestion({ id: newId, question: '', options: undefined, answer: '', questionType: 'single' as QuestionType });
  };

  const saveToBank = () => {
    if (previewQuestions.length === 0) return;
    addBank(previewBankName, previewSource, previewQuestions);
    clearPreview();
  };

  const cancelPreview = () => {
    clearPreview();
  };

  const handlePasteParse = () => {
    if (!pasteText.trim()) return;
    const questions = processText(pasteText);
    if (questions.length > 0) {
      setPreview(questions, pasteName || '粘贴导入', '文本粘贴');
    }
  };


  if (previewQuestions.length > 0) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>预览题目</h1>
          <p className={styles.subtitle}>
            {previewBankName} · {previewQuestions.length}题 · 点击题目可编辑，确认无误后保存
          </p>
        </header>

        <div className={styles.previewActions}>
          <button className={styles.addQuestionBtn} onClick={handleAddQuestion}>+ 添加题目</button>
          <div className={styles.previewStats}>
            {(['single', 'multiple', 'judge', 'essay'] as QuestionType[]).map(type => {
              const count = previewQuestions.filter(q => q.questionType === type).length;
              return count > 0 ? (
                <span key={type} className={styles.statBadge}>{QUESTION_TYPE_SHORT_LABELS[type]} {count}</span>
              ) : null;
            })}
          </div>
        </div>

        <div className={styles.previewList}>
          {previewQuestions.map((q) => (
            <div key={q.id} className={styles.previewItem}>
              {editingId === q.id ? (
                <div className={styles.editForm}>
                  <div className={styles.editRow}>
                    <label>题型</label>
                    <select
                      value={editField.questionType || 'single'}
                      onChange={e => { const v = e.target.value; if (isQuestionType(v)) updateEdit({ questionType: v }); }}
                    >
                      <option value="single">单选题</option>
                      <option value="multiple">多选题</option>
                      <option value="judge">判断题</option>
                      <option value="essay">简答题</option>
                    </select>
                  </div>
                  <div className={styles.editRow}>
                    <label>题目</label>
                    <textarea
                      value={editField.question || ''}
                      onChange={e => updateEdit({ question: e.target.value })}
                      rows={3}
                    />
                  </div>
                  {(editField.questionType === 'single' || editField.questionType === 'multiple') && (
                    <div className={styles.editRow}>
                      <label>选项（每行一个，格式：A. 选项内容）</label>
                      <textarea
                        value={editField.options?.map(o => `${o.key}. ${o.text}`).join('\n') || ''}
                        onChange={e => {
                          const lines = e.target.value.split('\n').filter(l => l.trim());
                          const opts = lines.map(l => {
                            const match = l.match(/^([A-F])[.、．]\s*(.+)/);
                            return match ? { key: match[1], text: match[2].trim() } : { key: l.charAt(0), text: l.replace(/^[A-F][.、．]\s*/, '').trim() };
                          });
                          updateEdit({ options: opts.length > 0 ? opts : undefined });
                        }}
                        rows={4}
                        placeholder={"A. 选项一\nB. 选项二\nC. 选项三\nD. 选项四"}
                      />
                    </div>
                  )}
                  <div className={styles.editRow}>
                    <label>答案</label>
                    <input
                      type="text"
                      value={typeof editField.answer === 'string' ? editField.answer : Array.isArray(editField.answer) ? editField.answer.join('') : ''}
                      onChange={e => {
                        const val = e.target.value;
                        if (editField.questionType === 'multiple') {
                          updateEdit({ answer: val.split('').filter(c => /[A-F]/.test(c)) });
                        } else {
                          updateEdit({ answer: val });
                        }
                      }}
                      placeholder={editField.questionType === 'multiple' ? '如 ABCD' : '如 A'}
                    />
                  </div>
                  <div className={styles.editRow}>
                    <label>题目图片 URL（可选）</label>
                    <input
                      type="text"
                      value={editField.questionImage || ''}
                      onChange={e => updateEdit({ questionImage: e.target.value || undefined })}
                      placeholder="https://example.com/image.png"
                    />
                  </div>
                  <div className={styles.editRow}>
                    <label>答案解析图片 URL（可选）</label>
                    <input
                      type="text"
                      value={editField.answerImage || ''}
                      onChange={e => updateEdit({ answerImage: e.target.value || undefined })}
                      placeholder="https://example.com/answer.png"
                    />
                  </div>
                  <div className={styles.editButtons}>
                    <button className={styles.saveEditBtn} onClick={saveEdit}>保存</button>
                    <button className={styles.cancelEditBtn} onClick={cancelEdit}>取消</button>
                  </div>
                </div>
              ) : (
                <div className={styles.previewContent} onClick={() => startEdit(q)}>
                  <div className={styles.previewHeader}>
                    <span className={styles.previewId}>#{q.id}</span>
                    <span className={`${styles.typeTag} ${q.questionType}`}>{QUESTION_TYPE_SHORT_LABELS[q.questionType]}</span>
                    <span className={styles.previewAnswer}>答案: {Array.isArray(q.answer) ? q.answer.join('') : q.answer}</span>
                    <button className={styles.deleteBtn} onClick={(e) => { e.stopPropagation(); deleteQuestion(q.id); }}>删除</button>
                  </div>
                  <div className={styles.previewQuestion}>{q.question}</div>
                  {q.options && q.options.length > 0 && (
                    <div className={styles.previewOptions}>
                      {q.options.map(o => (
                        <span key={o.key} className={styles.optionTag}>{o.key}. {o.text}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className={styles.bottomBar}>
          <button className={styles.cancelPreviewBtn} onClick={cancelPreview}>放弃</button>
          <button className={styles.saveBankBtn} onClick={saveToBank}>保存题库</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>上传题库</h1>
        <p className={styles.subtitle}>支持 Word、PDF、Excel、TXT、Markdown、JSON 格式</p>
      </header>

      <div
        className={styles.dropZone}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className={styles.dropIcon}>📁</div>
        <p className={styles.dropText}>拖拽文件到这里，或点击选择文件</p>
        <p className={styles.dropHint}>支持批量上传</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".docx,.pdf,.xlsx,.txt,.md,.json,.png,.jpg,.jpeg"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>

      {window.electronAPI && (
        <button className={styles.electronBtn} onClick={handleElectronFileSelect}>
          🖥️ 从电脑选择文件
        </button>
      )}

      <button
        className={styles.pasteToggle}
        onClick={togglePaste}
      >
        {showPaste ? '收起' : '或粘贴文本内容'}
      </button>
      {showPaste && (
          <div className={styles.pasteForm}>
            <div className={styles.formatGuide}>
              <div className={styles.formatHeader}>
                <h4>标准文本格式规范</h4>
                <button
                  className={styles.copyGuideBtn}
                  onClick={() => {
                    const text = `【格式规范】

每道题必须包含：
1. 题目行：以"数字."开头，如 "1. 题目内容"
2. 选项行：以"字母."开头，如 "A. 选项内容"（选择题必须有，填空/简答不需要）
3. 答案行：以"答案："开头，如 "答案：A"

完整格式：

[单选题]
1. 安全生产方针是
A. 安全第一
B. 效率优先
C. 质量为主
D. 成本优先
答案：A

[多选题]
2. 以下属于安全红线的有
A. 转包
B. 违法分包
C. 数据造假
D. 偷工减料
答案：ABCD

[填空题]
3. 安全生产方针是______
答案：安全第一、预防为主、综合治理

[简答题]
4. 简述安全生产的重要性
答案：安全生产关系到人民群众的生命财产安全...

[判断题]
5. 安全生产只是企业的事
答案：错

【转换规则】
- 题型用方括号标识：[单选题][多选题][填空题][简答题][判断题]
- 每题之间空一行
- 单选题答案：1个字母，如 答案：A
- 多选题答案：多个字母连写，如 答案：ABCD
- 填空题/简答题答案：直接写文本
- 判断题答案：写"对"或"错"
- 解析（可选）：答案行后面写"解析：解析内容"
- 不需要保留原题号，程序会自动编号
- 不需要保留分值、注意事项等非题目内容`;
                    navigator.clipboard.writeText(text).then(() => {
                      const btn = document.activeElement as HTMLButtonElement;
                      if (btn) { btn.textContent = '已复制'; setTimeout(() => { btn.textContent = '复制'; }, 1500); }
                    });
                  }}
                >复制</button>
              </div>
              <p>将以下规范发给AI，让它帮你转换题库格式：</p>
              <pre>{`【格式规范】

每道题必须包含：
1. 题目行：以"数字."开头，如 "1. 题目内容"
2. 选项行：以"字母."开头，如 "A. 选项内容"（选择题必须有，填空/简答不需要）
3. 答案行：以"答案："开头，如 "答案：A"

完整格式：

[单选题]
1. 安全生产方针是
A. 安全第一
B. 效率优先
C. 质量为主
D. 成本优先
答案：A

[多选题]
2. 以下属于安全红线的有
A. 转包
B. 违法分包
C. 数据造假
D. 偷工减料
答案：ABCD

[填空题]
3. 安全生产方针是______
答案：安全第一、预防为主、综合治理

[简答题]
4. 简述安全生产的重要性
答案：安全生产关系到人民群众的生命财产安全...

[判断题]
5. 安全生产只是企业的事
答案：错

【转换规则】
- 题型用方括号标识：[单选题][多选题][填空题][简答题][判断题]
- 每题之间空一行
- 单选题答案：1个字母，如 答案：A
- 多选题答案：多个字母连写，如 答案：ABCD
- 填空题/简答题答案：直接写文本
- 判断题答案：写"对"或"错"
- 解析（可选）：答案行后面写"解析：解析内容"
- 不需要保留原题号，程序会自动编号
- 不需要保留分值、注意事项等非题目内容`}</pre>
            </div>
            <input
              type="text"
              className={styles.pasteNameInput}
              placeholder="题库名称（可选）"
              value={pasteName}
              onChange={e => setPasteName(e.target.value)}
            />
            <textarea
              className={styles.pasteTextarea}
              placeholder="在此粘贴题目内容..."
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              rows={12}
            />
            <button
              className={styles.processButton}
              onClick={handlePasteParse}
              disabled={!pasteText.trim()}
            >
              解析并预览
            </button>
          </div>
        )}

      <div className={styles.formatList}>
        <h3 className={styles.formatTitle}>支持的文件格式</h3>
        <div className={styles.formatItems}>
          {supportedFormats.map(format => (
            <span key={format.ext} className={styles.formatItem}>
              {format.icon} {format.name}
            </span>
          ))}
        </div>
      </div>

      {files.length > 0 && (
        <div className={styles.filesSection}>
          <h3 className={styles.sectionTitle}>待处理文件 ({files.length})</h3>
          <div className={styles.filesList}>
            {files.map(file => (
              <div key={file.id} className={styles.fileItem}>
                <div className={styles.fileInfo}>
                  <span className={styles.fileIcon}>{getFileIcon(file.name)}</span>
                  <div className={styles.fileDetails}>
                    <span className={styles.fileName}>{file.name}</span>
                    <span className={styles.fileSize}>{formatFileSize(file.size)}</span>
                  </div>
                </div>
                <div className={styles.fileStatus}>
                  {getStatusBadge(file.status)}
                  {file.error && <span className={styles.errorText}>{file.error}</span>}
                  {file.questionsCount && (
                    <span className={styles.questionsCount}>
                      {file.questionsCount}题
                      {file.questionTypeStats && (
                        <span className={styles.typeBreakdown}>
                          {formatTypeBreakdown(file.questionTypeStats)}
                        </span>
                      )}
                    </span>
                  )}
                </div>
                {file.status !== 'processing' && (
                  <button className={styles.removeButton} onClick={() => removeFile(file.id)}>✕</button>
                )}
              </div>
            ))}
          </div>

          {files.some(f => f.status === 'pending') && (
            <button
              className={styles.processButton}
              onClick={processFiles}
              disabled={isProcessing}
            >
              {isProcessing ? '处理中...' : '解析并预览'}
            </button>
          )}
        </div>
      )}

      {banks.length > 0 && (
        <div className={styles.banksSection}>
          <h3 className={styles.sectionTitle}>已导入题库 ({banks.length})</h3>
          <div className={styles.banksList}>
            {banks.map(bank => (
              <div key={bank.id} className={styles.bankItem}>
                <div className={styles.bankInfo}>
                  <span className={styles.bankIcon}>📚</span>
                  <div className={styles.bankDetails}>
                    <span className={styles.bankName}>{bank.name}</span>
                    <span className={styles.bankMeta}>
                      {bank.questions.length}题 · 来源: {bank.source}
                    </span>
                  </div>
                </div>
                <div className={styles.bankActions}>
                  <button className={styles.useButton} onClick={() => handleUseBank(bank.id)}>使用</button>
                  <button className={styles.removeBankButton} onClick={() => removeBank(bank.id)}>删除</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button className={styles.backButton} onClick={() => navigate('/')}>返回首页</button>
    </div>
  );
};

export default Upload;
