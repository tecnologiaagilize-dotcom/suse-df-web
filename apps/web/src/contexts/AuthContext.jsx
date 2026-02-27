import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null); // 'driver' | 'operator' | 'supervisor' | 'admin'

  useEffect(() => {
    let mounted = true;

    // Safety timeout to prevent infinite loading state
    const loadingTimeout = setTimeout(() => {
      if (loading) {
        console.warn("Auth check timed out, forcing loading to false");
        setLoading(false);
      }
    }, 8000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRole(session.user);
      } else {
        setLoading(false);
      }
    }).catch(err => {
      console.error("Session check failed:", err);
      if (mounted) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRole(session.user);
      } else {
        setUserRole(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(loadingTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserRole = async (currentUser) => {
    try {
      // 1. Check if user is Staff (Safe Check)
      let staffData = null;
      try {
        const { data, error } = await supabase
            .from('staff')
            .select('role')
            .eq('email', currentUser.email)
            .maybeSingle();
            
        if (!error) staffData = data;
      } catch (err) {
        // Ignora erro de permissão (400/403) se usuário não for staff
        console.log("Check staff falhou (normal para motoristas):", err);
      }

      if (staffData) {
        setUserRole(staffData.role);
        setLoading(false);
        return;
      }

      // 2. Check if user is Driver/Passenger (Users table)
      let userData = null;
      try {
        const { data, error } = await supabase
            .from('users')
            .select('role')
            .eq('id', currentUser.id)
            .maybeSingle();
        if (!error) userData = data;
      } catch (err) {
         console.log("Check users falhou:", err);
      }

      if (userData) {
        setUserRole(userData.role || 'driver');
        setLoading(false);
        return;
      }

      // 3. Fallback to Metadata
      if (currentUser.user_metadata?.role) {
        setUserRole(currentUser.user_metadata.role);
      } else {
        setUserRole('driver'); // Default
      }

    } catch (error) {
      console.error('Error fetching role:', error);
      setUserRole('driver');
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;

    // Verificar se precisa trocar senha (apenas para staff)
    let mustChangePassword = false;
    if (data.user) {
      // Tenta buscar staff apenas se o email parecer corporativo ou se não for um usuário comum
      // Para evitar erro 400 em emails inválidos ou sem permissão de leitura na tabela staff
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('must_change_password')
        .eq('email', email)
        .maybeSingle();
      
      // Ignoramos erro aqui pois usuários comuns (passageiro/motorista) não estão na tabela staff
      if (!staffError && staffData?.must_change_password) {
        mustChangePassword = true;
      }
    }

    return { ...data, mustChangePassword };
  };

  const signUp = async ({ email, password, name, phone, emergencyPhrase, role = 'driver' }) => {
    // 1. Create Auth User
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role,
          name,
          phone_number: phone,
          emergency_phrase: emergencyPhrase,
        },
      },
    });

    if (error) throw error;

    // 2. Insert into Public Table (if session is active immediately)
    // Note: If email confirmation is enabled, this might fail or need to be done via Trigger
    if (data?.user && (role === 'driver' || role === 'passenger')) {
      const { error: dbError } = await supabase
        .from('users')
        .insert([
          {
            id: data.user.id,
            email: email,
            name: name,
            phone_number: phone,
            secret_word: emergencyPhrase,
            role: role
          }
        ]);
      
      if (dbError) {
        console.warn('Could not create user profile in DB (might need email confirmation first):', dbError);
      }
    }

    return data;
  };

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });
    if (error) throw error;
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) console.error("Erro no logout remoto:", error);
    } catch (err) {
      console.error("Exceção no logout:", err);
    } finally {
      // Forçar limpeza local independente de erro de rede
      setUser(null);
      setUserRole(null);
      // Opcional: Limpar localStorage se houver dados persistidos manualmente
    }
  };

  return (
    <AuthContext.Provider value={{ user, userRole, signIn, signUp, signOut, resetPassword, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
