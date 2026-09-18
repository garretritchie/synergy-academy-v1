// Reviewed against the supplied Module 1 eBook v4.4. Never import answer keys into the browser bundle.
export const moduleOne = {
  key: "b1-101-module-01-v4.4",
  title: "AI foundations",
  source: "B1-101_Module_01_AI_foundations_v4.4.pdf",
  sourceNotes: [
    "PDF page references below refer to the supplied 30-page extract, not the printed whole-book pagination.",
    "The learning-journey deck references eBook v4.3. Use the supplied v4.4 eBook for this content package.",
    "The eBook specifies 20/40/20/20 grade weights. Existing cohorts retain their configured weights pending a separate reviewed grading change.",
    "No live dates, meeting URLs, captions or transcripts were supplied. Do not invent them.",
    "Questions are an eBook-derived portal check prepared for instructor review, not an official verbatim question bank.",
  ],
  assets: [
    {
      key: "ebook",
      file: "B1-101_Module_01_AI_foundations_v4.4.pdf",
      title: "Module 1 eBook — AI foundations (v4.4)",
      type: "pdf",
      mime: "application/pdf",
    },
    {
      key: "video",
      file: "Demystifying_AI.mp4",
      title: "Demystifying AI",
      type: "video",
      mime: "video/mp4",
    },
    {
      key: "audio",
      file: "Why_Business_AI_Needs_a_Human_Editor.m4a",
      title: "Why Business AI Needs a Human Editor",
      type: "audio",
      mime: "audio/mp4",
    },
    {
      key: "slides",
      file: "AI_Business_Essentials_Class_01_Learning_Journey_v9.2_Ready.pdf",
      title: "Class 1 learning journey (v9.2)",
      type: "pdf",
      mime: "application/pdf",
    },
  ],
  recap: [
    {
      title: "Start with the eBook",
      page: 7,
      lead: "Learn what AI can do, what its limits are, and where a person must check its work.",
      bullets: [
        "Read the Module 1 eBook first.",
        "Use this recap to prepare for practice and the live class.",
        "Work with fictional information in the workshop activity.",
      ],
    },
    {
      title: "AI is the wider field",
      page: 8,
      lead: "Artificial intelligence is a broad field. Different systems solve different kinds of tasks.",
      bullets: [
        "Rules follow instructions people define.",
        "Machine learning finds patterns in examples.",
        "Generative AI produces new content from learned patterns.",
      ],
    },
    {
      title: "Generation is not verification",
      page: 8,
      lead: "A generative system can draft text, images, audio or code. A convincing response can still be inaccurate.",
      bullets: [
        "Treat an output as a draft.",
        "Check facts and unsupported claims.",
        "A fluent answer is not proof of truth or originality.",
      ],
    },
    {
      title: "Model, product and provider",
      page: 10,
      lead: "The model performs the underlying computation. The product is the interface you use. The provider operates or supplies the service.",
      bullets: [
        "A product can use more than one model.",
        "Features and data settings belong to the product as well as the model.",
        "Name the tool and task clearly when discussing your work.",
      ],
    },
    {
      title: "Prompt, tokens and context",
      page: 10,
      lead: "Your prompt gives the request and supporting information. The system processes content in tokens within a limited context window.",
      bullets: [
        "Include the facts the task needs.",
        "Specify the intended output.",
        "Do not assume the tool remembers everything from earlier work.",
      ],
    },
    {
      title: "Different ways to learn patterns",
      page: 16,
      lead: "AI training can use labelled examples, unlabelled patterns, reward signals or prediction from the data itself.",
      bullets: [
        "Supervised learning uses labelled examples.",
        "Unsupervised learning looks for structure.",
        "Reinforcement learning uses rewards.",
        "Self-supervised learning derives learning signals from the data.",
      ],
    },
    {
      title: "Training and using a model",
      page: 17,
      lead: "Training adjusts a model using examples. Inference uses the trained model to produce a result for a new input.",
      bullets: [
        "Testing asks how well the model handles examples beyond its training.",
        "Generalization means useful performance on new cases.",
        "Overfitting means fitting training examples too closely.",
      ],
    },
    {
      title: "Neural networks work with numbers",
      page: 18,
      lead: "A neural network transforms numerical inputs through layers and learned weights.",
      bullets: [
        "The brain-inspired name does not make it a human brain.",
        "A useful result does not imply human understanding.",
        "Choose a tool based on the task and checked results.",
      ],
    },
    {
      title: "A long history of progress and limits",
      page: 12,
      lead: "AI developed through research advances, specialist systems, setbacks and larger-scale learning.",
      bullets: [
        "The field predates today’s chat products.",
        "Rules, expert systems and machine learning remain useful approaches.",
        "Modern generative tools build on earlier advances.",
      ],
    },
    {
      title: "Put a person before the action",
      page: 20,
      lead: "Use a clear flow: task → input → model → review → action.",
      bullets: [
        "Check that the input is suitable to share.",
        "Review the result against the original facts.",
        "Approve the final action yourself.",
      ],
      callout: "An AI draft does not approve itself.",
    },
    {
      title: "Practice: workshop checklist",
      page: 20,
      lead: "Turn the supplied office note into exactly six checklist items, then a table.",
      bullets: [
        "Keep 12 chairs, 12 handouts and 12 bottles of water.",
        "Keep the 9:45 a.m. room opening and 10 a.m. workshop start.",
        "Keep projector testing and the door sign.",
        "Save both layouts and explain which is more useful.",
      ],
    },
    {
      title: "Check before sending",
      page: 22,
      lead: "In the late-order case, a helpful-sounding draft invents a delivery promise and a refund. Remove unsupported details.",
      bullets: [
        "Compare every promise with the information provided.",
        "Correct invented facts, dates or commitments.",
        "Let the responsible person approve the customer response.",
      ],
    },
    {
      title: "Ready to apply it",
      page: 23,
      lead: "Explain generative AI, describe what a prompt does, and identify where human review belongs.",
      bullets: [
        "Complete the workshop activity and save your evidence.",
        "Use the assessment to check understanding.",
        "Bring one question to the live class.",
      ],
    },
  ],
  activity: {
    title: "Make a workshop checklist",
    max_points: 100,
    instructions: `Instructions
Open a new chat in ChatGPT or Gemini. Use only the fictional note below; a paper version is an acceptable fallback.
Send this prompt: Turn this rough office note into a clear checklist for setting up a staff workshop. Use exactly six items. Begin each item with an action word. Keep all quantities and times. Do not add tasks, people, or dates.
Rough note: before the staff workshop starts at 10 a.m. we need 12 chairs set out and 12 handouts printed. someone needs to test the projector. put a sign on the meeting room door and put 12 bottles of water on the table. open the room at 9:45 a.m.
Count the six tasks and check every quantity and time against the note. Correct anything that does not match.
Send this follow-up: Turn that checklist into a table with three columns: Task, Person responsible, and Done. Keep the same six tasks, quantities, and times. Put "To assign" in every Person responsible cell. Leave the Done cells blank so I can tick them later.
Save both layouts as M01 - Workshop Checklist. Write one sentence explaining your preferred layout and note a correction you made, or write “All six tasks and details match.”
Self-check
Both layouts contain exactly six tasks.
All quantities and times match the fictional note.
No people, dates or tasks have been invented.
I saved the checklist, table and preference/correction note.`,
    evidence:
      "Upload the checklist and table together with your preference/correction note. A PDF, document or clear screenshots are acceptable. Put the preference sentence in your written response as well.",
  },
  assessment: {
    title: "Module 1 — AI foundations check",
    instructions:
      "Choose the best answer, or all correct answers when indicated. Review each response before submitting. This instructor-review content package uses a 70% pass mark and two attempts; your instructor can change those settings before release.",
    max_attempts: 2,
    passing_score: 70,
    shuffle: true,
    reveal: true,
    graded: false,
    questions: [
      [
        "multiple_choice",
        "What does generative AI produce?",
        [
          "New content based on learned patterns",
          "Only a list of stored web links",
          "Guaranteed verified facts",
        ],
        "New content based on learned patterns",
        "Generation produces content; its accuracy still needs checking.",
      ],
      [
        "multiple_choice",
        "What is a prompt?",
        [
          "A request with supporting information",
          "A guarantee that an answer is correct",
          "The company that owns a product",
        ],
        "A request with supporting information",
        "A prompt tells the tool what you want and supplies relevant context.",
      ],
      [
        "multiple_choice",
        "Which input is appropriate for the workshop exercise?",
        [
          "The fictional office note provided",
          "A private customer record",
          "A colleague’s password",
        ],
        "The fictional office note provided",
        "Use the supplied fictional material.",
      ],
      [
        "true_false",
        "A fluent AI answer is proof that its facts are correct.",
        ["True", "False"],
        "False",
        "Fluent language can contain invented or mistaken claims.",
      ],
      [
        "multiple_select",
        "What must you check in the workshop output?",
        [
          "Exactly six tasks",
          "The quantities and times",
          "Whether new people or tasks were invented",
          "Whether the AI sounds confident",
        ],
        "Exactly six tasks\nThe quantities and times\nWhether new people or tasks were invented",
        "Check the output against the note and the requested constraints. Confidence is not evidence.",
      ],
      [
        "multiple_choice",
        "What is inference?",
        [
          "Using a trained model on an input",
          "Approving a customer promise",
          "Manually labelling every future answer",
        ],
        "Using a trained model on an input",
        "Training learns patterns; inference uses the trained model.",
      ],
      [
        "multiple_choice",
        "A model fits its training examples very closely but performs poorly on new examples. What is this called?",
        ["Overfitting", "Human review", "A context window"],
        "Overfitting",
        "Generalization is performance on new cases; overfitting reduces it.",
      ],
      [
        "true_false",
        "A model and the product interface you use are always the same thing.",
        ["True", "False"],
        "False",
        "The model, product and provider are distinct concepts.",
      ],
      [
        "multiple_select",
        "An AI draft promises an unconfirmed delivery date and refund. What should you do?",
        [
          "Check the original facts",
          "Remove unsupported promises",
          "Have the responsible person approve the response",
          "Send it because it sounds helpful",
        ],
        "Check the original facts\nRemove unsupported promises\nHave the responsible person approve the response",
        "Human review belongs before the action.",
      ],
      [
        "multiple_choice",
        "Which workflow includes a human checkpoint?",
        [
          "Task → input → model → review → action",
          "Task → model → send automatically",
          "Model → assume correct → action",
        ],
        "Task → input → model → review → action",
        "Review the model’s result before taking the action.",
      ],
    ].map(
      ([
        question_type,
        question_text,
        options,
        correct_answer,
        explanation,
      ]) => ({
        question_type,
        question_text,
        options,
        correct_answer,
        explanation,
      }),
    ),
  },
};
