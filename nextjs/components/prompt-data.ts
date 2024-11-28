export type SimplePrompt = {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
  isFavorite: boolean
  isComplex: false
}

export type ComplexPrompt = {
  id: string
  title: string
  content: {
    variables: {
      fieldName: string
      required: boolean
      controlType: string
      placeholder?: string
      options?: string[]
      preselectedOption?: string
    }[]
    prompt: string
  }
  category: string
  tags: string[]
  isFavorite: boolean
  isComplex: true
}

export type Prompt = SimplePrompt | ComplexPrompt

export const promptsData: Prompt[] = [
  {
    id: "1",
    title: "Greeting",
    content: "Hello, how can I assist you today?",
    category: "General",
    tags: ["greeting"],
    isFavorite: false,
    isComplex: false
  },
  {
    id: "2",
    title: "Farewell",
    content: "Thank you for using our service. Have a great day!",
    category: "General",
    tags: ["farewell"],
    isFavorite: true,
    isComplex: false
  },
  {
    id: "3",
    title: "Blog Post",
    content: {
      variables: [
        {
          fieldName: "Topic",
          required: true,
          controlType: "textarea",
          placeholder: "Short description about your blog post"
        },
        {
          fieldName: "Tone",
          required: false,
          controlType: "dropdown",
          options: ["Playful", "Serious", "Funny"],
          preselectedOption: "Serious"
        }
      ],
      prompt: "Create a detailed blog post about {Topic}. The tone should be {Tone}."
    },
    category: "Writing",
    tags: ["blog"],
    isFavorite: false,
    isComplex: true
  },
  {
    id: "4",
    title: "LinkedIn Post",
    content: {
      variables: [
        {
          fieldName: "Topic",
          required: true,
          controlType: "textarea",
          placeholder: "Short description about your LinkedIn post"
        },
        {
          fieldName: "Tone",
          required: false,
          controlType: "dropdown",
          options: ["Playful", "Serious", "Funny"]
        }
      ],
      prompt: "Create a detailed LinkedIn post about {Topic}. The tone should be {Tone}."
    },
    category: "Social Media",
    tags: ["linkedin"],
    isFavorite: false,
    isComplex: true
  },
  {
    id: "5",
    title: "SEM Ads",
    content: {
      variables: [
        {
          fieldName: "Company Name",
          required: true,
          controlType: "input",
          placeholder: "Enter your company name"
        },
        {
          fieldName: "Sample Searches",
          required: true,
          controlType: "textarea",
          placeholder: "Enter sample search queries"
        },
        {
          fieldName: "Audiences",
          required: true,
          controlType: "input",
          placeholder: "Enter target audiences"
        },
        {
          fieldName: "Product Name",
          required: true,
          controlType: "input",
          placeholder: "Enter your product name"
        },
        {
          fieldName: "Landing Page",
          required: true,
          controlType: "textarea",
          placeholder: "Describe your landing page"
        },
        {
          fieldName: "Brand Voice",
          required: true,
          controlType: "textarea",
          placeholder: "Describe your brand voice"
        },
        {
          fieldName: "Challenges",
          required: true,
          controlType: "textarea",
          placeholder: "Describe customer challenges"
        },
        {
          fieldName: "Benefits",
          required: true,
          controlType: "textarea",
          placeholder: "List product benefits"
        },
        {
          fieldName: "Lead Magnet",
          required: true,
          controlType: "textarea",
          placeholder: "Describe your lead magnet"
        }
      ],
      prompt: "Create SEM ads for {Company Name} targeting {Audiences} for the product {Product Name}. The ads should address the following challenges: {Challenges}, highlight these benefits: {Benefits}, and use this brand voice: {Brand Voice}. The landing page will feature: {Landing Page}. Use these sample searches for keyword inspiration: {Sample Searches}. Include a call-to-action for this lead magnet: {Lead Magnet}."
    },
    category: "Marketing",
    tags: ["sem", "advertising"],
    isFavorite: false,
    isComplex: true
  }
]